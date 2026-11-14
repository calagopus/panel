use std::{borrow::Cow, collections::VecDeque, path::PathBuf, sync::Arc};
use tokio::sync::{RwLock, Semaphore};

#[derive(Clone, Copy, Debug)]
pub enum FileType {
    File,
    Dir,
    Symlink,
    Unknown,
}

impl FileType {
    #[inline]
    pub fn from_is_dir(is_dir: bool) -> Self {
        if is_dir {
            FileType::Dir
        } else {
            FileType::File
        }
    }

    #[inline]
    pub fn is_file(self) -> bool {
        matches!(self, FileType::File)
    }

    #[inline]
    pub fn is_dir(self) -> bool {
        matches!(self, FileType::Dir)
    }

    #[inline]
    pub fn is_symlink(self) -> bool {
        matches!(self, FileType::Symlink)
    }
}

impl From<cap_std::fs::FileType> for FileType {
    fn from(ft: cap_std::fs::FileType) -> Self {
        match () {
            _ if ft.is_file() => FileType::File,
            _ if ft.is_dir() => FileType::Dir,
            _ if ft.is_symlink() => FileType::Symlink,
            _ => FileType::Unknown,
        }
    }
}

impl From<std::fs::FileType> for FileType {
    fn from(ft: std::fs::FileType) -> Self {
        match () {
            _ if ft.is_file() => FileType::File,
            _ if ft.is_dir() => FileType::Dir,
            _ if ft.is_symlink() => FileType::Symlink,
            _ => FileType::Unknown,
        }
    }
}

pub struct AsyncReadDir(
    pub Option<cap_std::fs::ReadDir>,
    pub Option<VecDeque<std::io::Result<cap_std::fs::DirEntry>>>,
);

impl AsyncReadDir {
    pub async fn next(&mut self) -> Option<std::io::Result<cap_std::fs::DirEntry>> {
        if let Some(buffer) = self.1.as_mut()
            && !buffer.is_empty()
        {
            return buffer.pop_front();
        }

        let mut read_dir = self.0.take()?;
        let mut buffer = self.1.take()?;

        match tokio::task::spawn_blocking(move || {
            for _ in 0..128 {
                if let Some(entry) = read_dir.next() {
                    buffer.push_back(entry);
                } else {
                    break;
                }
            }

            (buffer, read_dir)
        })
        .await
        {
            Ok((buffer, read_dir)) => {
                self.0 = Some(read_dir);
                self.1 = Some(buffer);

                self.1.as_mut()?.pop_front()
            }
            Err(_) => None,
        }
    }

    pub async fn next_entry(&mut self) -> Option<std::io::Result<(FileType, String)>> {
        Some(self.next().await?.map(|entry| name_and_type(&entry)))
    }
}

pub struct ReadDir(pub cap_std::fs::ReadDir);

impl ReadDir {
    #[allow(clippy::should_implement_trait)]
    pub fn next(&mut self) -> Option<std::io::Result<cap_std::fs::DirEntry>> {
        self.0.next()
    }

    pub fn next_entry(&mut self) -> Option<std::io::Result<(FileType, String)>> {
        Some(self.next()?.map(|entry| name_and_type(&entry)))
    }
}

pub fn name_and_type(entry: &cap_std::fs::DirEntry) -> (FileType, String) {
    (
        entry.file_type().map_or(FileType::Unknown, FileType::from),
        entry
            .file_name()
            .into_string()
            .unwrap_or_else(|name| name.to_string_lossy().into_owned()),
    )
}

pub struct WalkEntry {
    pub path: PathBuf,
    file_type: FileType,
    entry: cap_std::fs::DirEntry,
}

impl WalkEntry {
    #[inline]
    pub fn file_type(&self) -> FileType {
        self.file_type
    }

    pub fn name(&self) -> Cow<'_, str> {
        match self.path.file_name() {
            Some(name) => name.to_string_lossy(),
            None => Cow::Borrowed(""),
        }
    }

    /// Does not follow symlinks.
    pub fn metadata(&self) -> Result<cap_std::fs::Metadata, std::io::Error> {
        self.entry.metadata()
    }

    /// Opens the entry for reading relative to the directory it was listed from,
    /// which skips resolving the whole path from the sandbox root again.
    pub fn open(&self) -> Result<std::fs::File, std::io::Error> {
        Ok(self.entry.open()?.into_std())
    }
}

fn is_ignored(
    ignored: &[ignore::gitignore::Gitignore],
    path: &std::path::Path,
    file_type: FileType,
) -> bool {
    ignored
        .iter()
        .any(|ignored| ignored.matched(path, file_type.is_dir()).is_ignore())
}

pub struct AsyncWalkDir<'a> {
    cap_filesystem: super::CapFilesystem,
    stack: Vec<(PathBuf, AsyncReadDir)>,
    ignored: &'a [ignore::gitignore::Gitignore],
}

impl<'a> AsyncWalkDir<'a> {
    pub async fn new(
        cap_filesystem: super::CapFilesystem,
        path: PathBuf,
    ) -> Result<Self, std::io::Error> {
        let read_dir = cap_filesystem.async_read_dir(&path).await?;

        Ok(Self {
            cap_filesystem,
            stack: vec![(path, read_dir)],
            ignored: &[],
        })
    }

    pub fn with_ignored(mut self, ignored: &'a [ignore::gitignore::Gitignore]) -> Self {
        self.ignored = ignored;
        self
    }

    pub async fn next_entry(&mut self) -> Option<Result<WalkEntry, std::io::Error>> {
        'stack: while let Some((parent_path, read_dir)) = self.stack.last_mut() {
            match read_dir.next().await {
                Some(Ok(entry)) => {
                    let file_type = entry.file_type().map_or(FileType::Unknown, FileType::from);
                    let full_path = parent_path.join(entry.file_name());

                    if crate::unlikely(is_ignored(self.ignored, &full_path, file_type)) {
                        continue 'stack;
                    }

                    if file_type.is_dir() {
                        match self.cap_filesystem.async_read_dir(&full_path).await {
                            Ok(dir) => self.stack.push((full_path.clone(), dir)),
                            Err(err) => return Some(Err(err)),
                        };
                    }

                    return Some(Ok(WalkEntry {
                        path: full_path,
                        file_type,
                        entry,
                    }));
                }
                Some(Err(err)) => return Some(Err(err)),
                None => {
                    self.stack.pop();
                }
            }
        }

        None
    }

    pub async fn run_multithreaded<F, Fut>(
        &mut self,
        threads: usize,
        func: Arc<F>,
    ) -> Result<(), anyhow::Error>
    where
        F: Fn(WalkEntry) -> Fut + Send + Sync + 'static,
        Fut: futures_util::Future<Output = Result<(), anyhow::Error>> + Send + 'static,
    {
        let semaphore = Arc::new(Semaphore::new(threads));
        let error = Arc::new(RwLock::new(None));

        while let Some(entry) = self.next_entry().await {
            let entry = entry?;

            let semaphore = Arc::clone(&semaphore);
            let error = Arc::clone(&error);
            let func = Arc::clone(&func);

            if crate::unlikely(error.read().await.is_some()) {
                break;
            }

            let permit = match semaphore.acquire_owned().await {
                Ok(permit) => permit,
                Err(_) => break,
            };
            tokio::spawn(async move {
                let _permit = permit;
                if let Err(err) = func(entry).await {
                    *error.write().await = Some(err);
                }
            });
        }

        semaphore.acquire_many(threads as u32).await.ok();

        if let Some(err) = error.write().await.take() {
            return Err(err);
        }

        Ok(())
    }
}

pub struct WalkDir<'a> {
    cap_filesystem: super::CapFilesystem,
    stack: Vec<(PathBuf, ReadDir)>,
    ignored: &'a [ignore::gitignore::Gitignore],
}

impl<'a> WalkDir<'a> {
    pub fn new(
        cap_filesystem: super::CapFilesystem,
        path: PathBuf,
    ) -> Result<Self, std::io::Error> {
        let read_dir = cap_filesystem.read_dir(&path)?;

        Ok(Self {
            cap_filesystem,
            stack: vec![(path, read_dir)],
            ignored: &[],
        })
    }

    pub fn with_ignored(mut self, ignored: &'a [ignore::gitignore::Gitignore]) -> Self {
        self.ignored = ignored;
        self
    }

    pub fn next_entry(&mut self) -> Option<Result<WalkEntry, std::io::Error>> {
        'stack: while let Some((parent_path, read_dir)) = self.stack.last_mut() {
            match read_dir.next() {
                Some(Ok(entry)) => {
                    let file_type = entry.file_type().map_or(FileType::Unknown, FileType::from);
                    let full_path = parent_path.join(entry.file_name());

                    if crate::unlikely(is_ignored(self.ignored, &full_path, file_type)) {
                        continue 'stack;
                    }

                    if file_type.is_dir() {
                        match self.cap_filesystem.read_dir(&full_path) {
                            Ok(dir) => self.stack.push((full_path.clone(), dir)),
                            Err(err) => return Some(Err(err)),
                        };
                    }

                    return Some(Ok(WalkEntry {
                        path: full_path,
                        file_type,
                        entry,
                    }));
                }
                Some(Err(err)) => return Some(Err(err)),
                None => {
                    self.stack.pop();
                }
            }
        }

        None
    }
}
