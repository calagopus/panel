use proc_macro::TokenStream;
use proc_macro2::{Span, TokenStream as TokenStream2};
use quote::{format_ident, quote};
use syn::{
    Attribute, Data, DeriveInput, Field, Fields, Ident, Meta, Path, Type, parse::Parser,
    parse_macro_input, punctuated::Punctuated, token::Comma,
};

#[proc_macro_attribute]
pub fn extendible(_attr: TokenStream, item: TokenStream) -> TokenStream {
    let mut input = parse_macro_input!(item as DeriveInput);

    let init_args_types = extract_attr_types(&mut input, "init_args");
    let hook_args_types = extract_attr_types(&mut input, "hook_args");
    let has_validate = has_derive(&input, "Validate");

    let struct_schema_attrs = take_struct_attrs(&mut input, "schema");

    remove_derive(&mut input, "ToSchema");

    let impl_block = match expand(
        &input,
        &init_args_types,
        &hook_args_types,
        &struct_schema_attrs,
    ) {
        Ok(ts) => ts,
        Err(e) => return e.to_compile_error().into(),
    };

    if let Err(e) = inject_overlay_field(&mut input, has_validate) {
        return e.to_compile_error().into();
    }
    strip_field_attr(&mut input, "schema");

    quote! { #input #impl_block }.into()
}

fn extract_attr_types(input: &mut DeriveInput, name: &str) -> Option<Vec<Type>> {
    let mut result: Option<Vec<Type>> = None;
    input.attrs.retain(|attr| {
        if attr.path().is_ident(name) {
            if let Meta::List(ml) = &attr.meta
                && let Ok(t) = Punctuated::<Type, Comma>::parse_terminated.parse2(ml.tokens.clone())
            {
                result = Some(t.into_iter().collect());
            }
            false
        } else {
            true
        }
    });
    result
}

fn take_struct_attrs(input: &mut DeriveInput, name: &str) -> Vec<Attribute> {
    let mut taken = Vec::new();
    input.attrs.retain(|attr| {
        if attr.path().is_ident(name) {
            taken.push(attr.clone());
            false
        } else {
            true
        }
    });
    taken
}

fn has_derive(input: &DeriveInput, name: &str) -> bool {
    input.attrs.iter().any(|a| {
        a.path().is_ident("derive")
            && a.parse_args_with(Punctuated::<Path, Comma>::parse_terminated)
                .map(|p| p.iter().any(|p| p.is_ident(name)))
                .unwrap_or(false)
    })
}

fn remove_derive(input: &mut DeriveInput, name: &str) {
    for attr in &mut input.attrs {
        if attr.path().is_ident("derive") {
            let Ok(paths) = attr.parse_args_with(Punctuated::<Path, Comma>::parse_terminated)
            else {
                continue;
            };
            let f: Punctuated<Path, Comma> =
                paths.into_iter().filter(|p| !p.is_ident(name)).collect();
            *attr = syn::parse_quote! { #[derive(#f)] };
        }
    }
}

fn strip_field_attr(input: &mut DeriveInput, name: &str) {
    if let Data::Struct(ref mut d) = input.data
        && let Fields::Named(ref mut f) = d.fields
    {
        for field in f.named.iter_mut() {
            field.attrs.retain(|a| !a.path().is_ident(name));
        }
    }
}

fn expand(
    input: &DeriveInput,
    init_args_types: &Option<Vec<Type>>,
    hook_args_types: &Option<Vec<Type>>,
    struct_schema_attrs: &[Attribute],
) -> syn::Result<TokenStream2> {
    let ident = &input.ident;
    let ident_str = ident.to_string();
    let fields = named_fields(input)?;

    let non_overlay: Vec<&Field> = fields
        .iter()
        .filter(|f| f.ident.as_ref().map(|i| i != "__overlay").unwrap_or(false))
        .collect();

    let schema_static = Ident::new(
        &format!("__SCHEMA_{}", ident).to_uppercase(),
        Span::call_site(),
    );
    let hooks_static = Ident::new(
        &format!("__HOOKS_{}", ident).to_uppercase(),
        Span::call_site(),
    );
    let validators_static = Ident::new(
        &format!("__VALIDATORS_{}", ident).to_uppercase(),
        Span::call_site(),
    );
    let inner_struct = format_ident!("__{}_Schema", ident);

    let inner_fields = non_overlay
        .iter()
        .map(|f| {
            let n = f.ident.as_ref().unwrap();
            let t = &f.ty;
            let a = f.attrs.iter().filter(|a| a.path().is_ident("schema"));
            quote! { #(#a)* pub #n: #t, }
        })
        .collect::<Vec<_>>();

    let user_set_title = struct_schema_attrs.iter().any(|a| {
        let mut found = false;
        let _ = a.parse_nested_meta(|nm| {
            if nm.path.is_ident("title") {
                found = true;
            }
            Ok(())
        });
        found
    });
    let default_title = if user_set_title {
        quote! {}
    } else {
        quote! { #[schema(title = #ident_str)] }
    };

    let ia: Vec<&Type> = init_args_types
        .as_ref()
        .map(|v| v.iter().collect())
        .unwrap_or_default();
    let ha: Vec<&Type> = hook_args_types
        .as_ref()
        .map(|v| v.iter().collect())
        .unwrap_or_default();
    let ia_n: Vec<Ident> = (0..ia.len()).map(|i| format_ident!("__ia_{}", i)).collect();
    let ha_n: Vec<Ident> = (0..ha.len()).map(|i| format_ident!("__ha_{}", i)).collect();

    let ia_alias = if !ia.is_empty() {
        let n = format_ident!("{}InitArgs", ident);
        quote! { pub type #n<'a> = (#(&'a #ia,)*); }
    } else {
        quote! {}
    };
    let ha_alias = if !ha.is_empty() {
        let n = format_ident!("{}HookArgs", ident);
        quote! { pub type #n<'a> = (#(&'a #ha,)*); }
    } else {
        quote! {}
    };

    let applier_fn_type = quote! {
        ::std::boxed::Box<
            dyn for<'__ha> ::std::ops::FnOnce(&mut #ident, #(&'__ha #ha),*)
                -> ::std::result::Result<(), ::anyhow::Error>
            + ::std::marker::Send
        >
    };

    let hook_fn_type = quote! {
        ::std::boxed::Box<
            dyn for<'__ia> ::std::ops::Fn(#(&'__ia #ia),*)
                -> ::std::pin::Pin<::std::boxed::Box<
                    dyn ::std::future::Future<
                        Output = ::std::result::Result<#applier_fn_type, ::anyhow::Error>
                    > + ::std::marker::Send + '__ia
                >>
            + ::std::marker::Send + ::std::marker::Sync
        >
    };

    let validator_fn_type = quote! { ::schema_extension_core::ExtensionValidatorFn };

    let ready_type = quote! { ::std::vec::Vec<#applier_fn_type> };

    Ok(quote! {
        #ia_alias
        #ha_alias

        #[doc(hidden)]
        #[derive(::utoipa::ToSchema)]
        #default_title
        #(#struct_schema_attrs)*
        #[allow(non_camel_case_types, dead_code)]
        struct #inner_struct { #(#inner_fields)* }

        impl ::utoipa::ToSchema for #ident {
            fn name() -> ::std::borrow::Cow<'static, str> {
                ::std::borrow::Cow::Borrowed(stringify!(#ident))
            }
        }
        impl ::utoipa::PartialSchema for #ident {
            fn schema() -> ::utoipa::openapi::RefOr<::utoipa::openapi::Schema> {
                <Self as ::schema_extension_core::Extendible>::merged_schema()
            }
        }

        static #schema_static: ::std::sync::LazyLock<
            ::std::sync::RwLock<::utoipa::openapi::schema::Object>
        > = ::std::sync::LazyLock::new(|| {
            match <#inner_struct as ::utoipa::PartialSchema>::schema() {
                ::utoipa::openapi::RefOr::T(::utoipa::openapi::Schema::Object(o)) =>
                    ::std::sync::RwLock::new(o),
                _ => ::std::sync::RwLock::new(::utoipa::openapi::schema::Object::default()),
            }
        });

        static #hooks_static: ::std::sync::LazyLock<
            ::std::sync::RwLock<::std::vec::Vec<#hook_fn_type>>
        > = ::std::sync::LazyLock::new(|| ::std::sync::RwLock::new(::std::vec::Vec::new()));

        static #validators_static: ::std::sync::LazyLock<
            ::std::sync::RwLock<::std::vec::Vec<#validator_fn_type>>
        > = ::std::sync::LazyLock::new(|| ::std::sync::RwLock::new(::std::vec::Vec::new()));

        impl ::schema_extension_core::Extendible for #ident {
            fn schema_mut() -> &'static ::std::sync::LazyLock<
                ::std::sync::RwLock<::utoipa::openapi::schema::Object>
            > { &#schema_static }

            fn validators() -> &'static ::std::sync::RwLock<::std::vec::Vec<#validator_fn_type>> {
                &*#validators_static
            }

            fn overlay_map_mut(&mut self) -> &mut ::serde_json::Map<::std::string::String, ::serde_json::Value> {
                &mut self.__overlay.map
            }
            fn overlay_map(&self) -> &::serde_json::Map<::std::string::String, ::serde_json::Value> {
                &self.__overlay.map
            }
        }

        impl #ident {
            pub fn extend<
                __Res: ::std::marker::Send + 'static,
                __E: ::utoipa::PartialSchema + ::serde::Serialize + 'static,
            >(
                resolver: impl for<'__ia> ::std::ops::Fn(#(&'__ia #ia),*)
                    -> ::std::pin::Pin<::std::boxed::Box<
                        dyn ::std::future::Future<Output = ::std::result::Result<__Res, ::anyhow::Error>>
                        + ::std::marker::Send + '__ia
                    >>
                    + ::std::marker::Send + ::std::marker::Sync + 'static,
                transform: impl for<'__ha> ::std::ops::Fn(&mut #ident, __Res, #(&'__ha #ha),*) -> __E
                    + ::std::marker::Send + ::std::marker::Sync + 'static,
            ) {
                let ext_schema = <__E as ::utoipa::PartialSchema>::schema();
                if let ::utoipa::openapi::RefOr::T(::utoipa::openapi::Schema::Object(ext_obj)) = ext_schema {
                    let mut schema = <Self as ::schema_extension_core::Extendible>::schema_mut().write().unwrap();
                    ::schema_extension_core::merge_schema_object(&mut schema, ext_obj);
                }

                let resolver = ::std::sync::Arc::new(resolver);
                let transform = ::std::sync::Arc::new(transform);

                let hook: #hook_fn_type = ::std::boxed::Box::new(move |#(#ia_n: &#ia),*| {
                    let resolver = resolver.clone();
                    let transform = transform.clone();
                    ::std::boxed::Box::pin(async move {
                        let resolved: __Res = resolver(#(#ia_n),*).await?;
                        let applier: #applier_fn_type = ::std::boxed::Box::new(
                            move |this: &mut #ident, #(#ha_n: &#ha),*| {
                                let ext = transform(this, resolved, #(#ha_n),*);
                                ::schema_extension_core::apply_extension_to_overlay(this, ext)
                            }
                        );
                        Ok(applier)
                    })
                });

                #hooks_static.write().unwrap().push(hook);
            }

            pub fn extend_validated<
                __Res: ::std::marker::Send + 'static,
                __E: ::utoipa::PartialSchema + ::serde::Serialize + ::serde::de::DeserializeOwned
                    + ::garde::Validate<Context = ()> + 'static,
            >(
                resolver: impl for<'__ia> ::std::ops::Fn(#(&'__ia #ia),*)
                    -> ::std::pin::Pin<::std::boxed::Box<
                        dyn ::std::future::Future<Output = ::std::result::Result<__Res, ::anyhow::Error>>
                        + ::std::marker::Send + '__ia
                    >>
                    + ::std::marker::Send + ::std::marker::Sync + 'static,
                transform: impl for<'__ha> ::std::ops::Fn(&mut #ident, __Res, #(&'__ha #ha),*) -> __E
                    + ::std::marker::Send + ::std::marker::Sync + 'static,
            ) {
                ::schema_extension_core::register_validator::<#ident, __E>(
                    <#ident as ::schema_extension_core::Extendible>::validators()
                );
                Self::extend(resolver, transform);
            }

            pub async fn init_hooks(#(#ia_n: &#ia),*) -> ::std::result::Result<#ready_type, ::anyhow::Error> {
                let mut ready: #ready_type = ::std::vec::Vec::new();
                let futs: ::std::vec::Vec<_> = {
                    let hooks = #hooks_static.read().unwrap();
                    hooks.iter().map(|hook| hook(#(#ia_n),*)).collect()
                };
                for fut in futs {
                    ready.push(fut.await?);
                }
                Ok(ready)
            }

            pub fn finish_hooks(
                instance: &mut Self,
                ready: #ready_type,
                #(#ha_n: &#ha),*
            ) -> ::std::result::Result<(), ::anyhow::Error> {
                for applier in ready {
                    (applier)(instance, #(#ha_n),*)?;
                }
                Ok(())
            }
        }
    })
}

fn inject_overlay_field(input: &mut DeriveInput, has_validate: bool) -> syn::Result<()> {
    let ident = input.ident.clone();
    let fields = named_fields_mut(input)?;
    if fields
        .iter()
        .any(|f| f.ident.as_ref().map(|i| i == "__overlay").unwrap_or(false))
    {
        return Ok(());
    }
    let f: Field = if has_validate {
        syn::parse_quote! { #[serde(flatten)] #[garde(dive)] pub __overlay: ::schema_extension_core::ExtensionOverlay<#ident> }
    } else {
        syn::parse_quote! { #[serde(flatten)] pub __overlay: ::schema_extension_core::ExtensionOverlay<#ident> }
    };
    fields.push(f);
    Ok(())
}

fn named_fields(input: &DeriveInput) -> syn::Result<&Punctuated<Field, Comma>> {
    match &input.data {
        Data::Struct(s) => match &s.fields {
            Fields::Named(f) => Ok(&f.named),
            _ => Err(syn::Error::new_spanned(&input.ident, "needs named fields")),
        },
        _ => Err(syn::Error::new_spanned(&input.ident, "needs struct")),
    }
}

fn named_fields_mut(input: &mut DeriveInput) -> syn::Result<&mut Punctuated<Field, Comma>> {
    let id = input.ident.clone();
    match &mut input.data {
        Data::Struct(s) => match &mut s.fields {
            Fields::Named(f) => Ok(&mut f.named),
            _ => Err(syn::Error::new_spanned(id, "needs named fields")),
        },
        _ => Err(syn::Error::new_spanned(id, "needs struct")),
    }
}
