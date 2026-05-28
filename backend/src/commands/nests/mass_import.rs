use clap::{Args, FromArgMatches};
use colored::Colorize;
use compact_str::ToCompactString;
use dialoguer::{Input, theme::ColorfulTheme};
use shared::models::ByUuid;
use std::{io::IsTerminal, path::PathBuf};

#[derive(Args)]
pub struct MassImportArgs {
    #[arg(
        long = "nest",
        help = "the uuid or name of the nest to mass-import eggs into"
    )]
    nest: Option<String>,

    #[arg(
        short = 'r',
        long = "recursive",
        help = "whether to recursively scan the import directory for eggs",
        default_value = "false"
    )]
    recursive: bool,
    #[arg(
        short = 'u',
        long = "update",
        help = "whether to update existing eggs that the imported ones may conflict with",
        default_value = "true"
    )]
    update: bool,
    #[arg(
        short = 'i',
        long = "ignore-errors",
        help = "whether to ignore import errors on specific eggs instead of aborting",
        default_value = "false"
    )]
    ignore_errors: bool,

    #[arg(help = "path to the eggs to import", value_hint = clap::ValueHint::DirPath)]
    path: String,
}

pub struct MassImportCommand;

impl shared::extensions::commands::CliCommand<MassImportArgs> for MassImportCommand {
    fn get_command(&self, command: clap::Command) -> clap::Command {
        command
    }

    fn get_executor(self) -> Box<shared::extensions::commands::ExecutorFunc> {
        Box::new(|env, arg_matches| {
            Box::pin(async move {
                let args = MassImportArgs::from_arg_matches(&arg_matches)?;
                let state = shared::AppState::new_cli(env).await?;

                let nest = match args.nest {
                    Some(nest) => nest,
                    None => {
                        if std::io::stdout().is_terminal() {
                            let nest: String = Input::with_theme(&ColorfulTheme::default())
                                .with_prompt("Name or UUID of Nest")
                                .interact_text()?;
                            nest
                        } else {
                            eprintln!(
                                "{}",
                                "nest arg is required when not running in an interactive terminal"
                                    .red()
                            );
                            return Ok(1);
                        }
                    }
                };

                let nest = if let Ok(uuid) = nest.parse() {
                    shared::models::nest::Nest::by_uuid_optional(&state.database, uuid).await
                } else {
                    shared::models::nest::Nest::by_name(&state.database, &nest).await
                }?;

                let Some(nest) = nest else {
                    eprintln!("{}", "nest not found".red());
                    return Ok(1);
                };

                eprintln!(
                    "nest {} found, scanning...",
                    nest.uuid.to_compact_string().cyan()
                );

                let filesystem = shared::cap::CapFilesystem::new(args.path.into())?;

                let handle_entry = async |entry: PathBuf| {
                    let metadata = match filesystem.async_metadata(&entry).await {
                        Ok(metadata) => metadata,
                        Err(_) => return Ok(()),
                    };

                    // if any egg is larger than 1 MB, something went horribly wrong in development
                    if !metadata.is_file() || metadata.len() > 1024 * 1024 {
                        return Ok(());
                    }

                    let file_content = match filesystem.async_read_to_string(&entry).await {
                        Ok(content) => content,
                        Err(_) => return Ok(()),
                    };
                    let exported_egg: shared::models::nest_egg::ExportedNestEgg =
                        if entry.extension().and_then(|s| s.to_str()) == Some("json") {
                            match serde_json::from_str(&file_content) {
                                Ok(egg) => egg,
                                Err(_) => return Ok(()),
                            }
                        } else {
                            match serde_norway::from_str(&file_content) {
                                Ok(egg) => egg,
                                Err(_) => return Ok(()),
                            }
                        };

                    match shared::models::nest_egg::NestEgg::import(
                        &state,
                        nest.uuid,
                        None,
                        exported_egg.clone(),
                    )
                    .await
                    {
                        Ok(nest_egg) => {
                            eprintln!(
                                "created nest egg {} successfully",
                                nest_egg.uuid.to_compact_string().cyan()
                            );
                        }
                        Err(err) if err.is_unique_violation() && args.update => {
                            let nest_egg = shared::models::nest_egg::NestEgg::by_nest_uuid_uuid(
                                &state.database,
                                nest.uuid,
                                exported_egg.uuid,
                            )
                            .await?;
                            let nest_egg = match nest_egg {
                                Some(nest_egg) => nest_egg,
                                None => match shared::models::nest_egg::NestEgg::by_nest_uuid_name(
                                    &state.database,
                                    nest.uuid,
                                    &exported_egg.name,
                                )
                                .await?
                                {
                                    Some(nest_egg) => nest_egg,
                                    None => {
                                        return Err(anyhow::anyhow!(
                                            "unable to find nest egg for conflicting import by uuid or name, perhaps it already exists in a different nest"
                                        ));
                                    }
                                },
                            };

                            nest_egg
                                .import_update(&state.database, exported_egg)
                                .await?;

                            eprintln!(
                                "updated nest egg {} successfully",
                                nest_egg.uuid.to_compact_string().cyan()
                            );
                        }
                        Err(err) => return Err(err.into()),
                    }

                    Ok::<_, anyhow::Error>(())
                };

                let mut imported_eggs = 0;

                if args.recursive {
                    let mut walker = filesystem.async_walk_dir(".").await?;
                    while let Some(Ok((is_dir, entry))) = walker.next_entry().await {
                        if is_dir
                            || !matches!(
                                entry.extension().and_then(|s| s.to_str()),
                                Some("json") | Some("yml") | Some("yaml")
                            )
                        {
                            continue;
                        }

                        let entry_string = entry.to_string_lossy().to_compact_string();

                        if let Err(err) = handle_entry(entry).await {
                            eprintln!(
                                "error while importing egg {}: {:?}",
                                entry_string.cyan(),
                                err
                            );
                            if !args.ignore_errors {
                                return Err(err);
                            }
                        } else {
                            imported_eggs += 1;
                        }
                    }
                } else {
                    let mut walker = filesystem.async_read_dir(".").await?;
                    while let Some(Ok((is_dir, entry))) = walker.next_entry().await {
                        let entry = PathBuf::from(entry);

                        if is_dir
                            || !matches!(
                                entry.extension().and_then(|s| s.to_str()),
                                Some("json") | Some("yml") | Some("yaml")
                            )
                        {
                            continue;
                        }

                        let entry_string = entry.to_string_lossy().to_compact_string();

                        if let Err(err) = handle_entry(entry).await {
                            eprintln!(
                                "error while importing egg {}: {:?}",
                                entry_string.cyan(),
                                err
                            );
                            if !args.ignore_errors {
                                return Err(err);
                            }
                        } else {
                            imported_eggs += 1;
                        }
                    }
                }

                if imported_eggs == 0 {
                    eprintln!(
                        "{} {} {}",
                        "no eggs could be imported, try adding".red(),
                        "--recursive".cyan(),
                        "or double-check the path".red()
                    );
                } else {
                    eprintln!(
                        "{} eggs have been imported into the nest",
                        imported_eggs.to_compact_string().cyan(),
                    );
                }

                Ok(0)
            })
        })
    }
}
