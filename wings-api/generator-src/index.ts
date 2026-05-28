import fs from "fs"
import http from "http"
import { oas31 } from "openapi3-ts"
import generateSchemaObject from "@/generate-schema-object"
import { pascalCase, snakeCase } from "change-case"
import { convertType } from "@/generate-schema-property"

// TODO 1.1.x: Make query params use defaultable structs instead of function arguments

const openapi: oas31.OpenAPIObject = JSON.parse(fs.readFileSync('../openapi.json', 'utf-8'))
const output = fs.createWriteStream('../src/lib.rs', { flags: 'w' })

output.write(`//! The Calagopus Panel Wings API library.
//!
//! Used for communicating with the Wings daemon. This library contains
//! auto-generated code from the OpenAPI specification as well as
//! some utilities for working with the Wings API. In 99% of cases you will
//! want to use the [crate::client::WingsClient] struct to interact with the API.

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

pub mod client;
mod extra;

use client::AsyncResponseReader;
pub use extra::*;

`)

const clientOutput = fs.createWriteStream('../src/client.rs', { flags: 'w' })

clientOutput.write(`// This file is auto-generated from OpenAPI spec. Do not edit manually.
use super::*;
use futures_util::TryStreamExt;
use reqwest::{Client, Method, StatusCode};
use serde::de::DeserializeOwned;
use std::{
    pin::Pin,
    sync::LazyLock,
    task::{Context, Poll},
};
use tokio::io::AsyncRead;

static CLIENT: LazyLock<Client> = LazyLock::new(|| {
    Client::builder()
        .user_agent("Calagopus Panel")
        .build()
        .expect("Failed to create reqwest client")
});

#[derive(Debug)]
pub enum ApiHttpError {
    Http(StatusCode, super::ApiError),
    Reqwest(reqwest::Error),
    MsgpackEncode(rmp_serde::encode::Error),
    MsgpackDecode(rmp_serde::decode::Error),
}

impl From<ApiHttpError> for anyhow::Error {
    fn from(value: ApiHttpError) -> Self {
        match value {
            ApiHttpError::Http(status, err) => {
                anyhow::anyhow!("wings api status code {status}: {}", err.error)
            }
            ApiHttpError::Reqwest(err) => anyhow::anyhow!(err),
            ApiHttpError::MsgpackEncode(err) => anyhow::anyhow!(err),
            ApiHttpError::MsgpackDecode(err) => anyhow::anyhow!(err),
        }
    }
}

pub struct AsyncResponseReader(Box<dyn AsyncRead + Send + Unpin>);

impl AsyncRead for AsyncResponseReader {
    fn poll_read(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut tokio::io::ReadBuf<'_>,
    ) -> Poll<std::io::Result<()>> {
        Pin::new(&mut self.0).poll_read(cx, buf)
    }
}

impl<'de> Deserialize<'de> for AsyncResponseReader {
    fn deserialize<D>(_deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        Ok(Self(Box::new(tokio::io::empty())))
    }
}

async fn request_impl<T: DeserializeOwned + 'static>(
    client: &WingsClient,
    method: Method,
    endpoint: impl AsRef<str>,
    body: Option<&impl Serialize>,
    body_raw: Option<compact_str::CompactString>,
) -> Result<T, ApiHttpError> {
    let url = format!(
        "{}{}",
        client.base_url.trim_end_matches('/'),
        endpoint.as_ref()
    );
    let mut request = CLIENT.request(method, &url);
    request = request.header("Accept", "application/msgpack");

    if !client.token.is_empty() {
        request = request.header("Authorization", format!("Bearer {}", client.token));
    }

    if let Some(body) = body {
        request = request.header("Content-Type", "application/msgpack");

        let mut bytes = Vec::new();
        let mut se = rmp_serde::Serializer::new(&mut bytes)
            .with_struct_map()
            .with_human_readable();
        if let Err(err) = body.serialize(&mut se) {
            return Err(ApiHttpError::MsgpackEncode(err));
        }
        request = request.body(bytes);
    } else if let Some(body_raw) = body_raw {
        request = request.body(Vec::from(body_raw));
    }

    match request.send().await {
        Ok(response) => {
            if response.status().is_success() {
                if std::any::type_name::<T>() == std::any::type_name::<AsyncResponseReader>() {
                    let stream = response.bytes_stream().map_err(|err| {
                        std::io::Error::other(format!("failed to read multipart field: {err}"))
                    });
                    let stream_reader = tokio_util::io::StreamReader::new(stream);

                    return Ok(*(Box::new(AsyncResponseReader(Box::new(stream_reader)))
                        as Box<dyn std::any::Any>)
                        .downcast::<T>()
                        .unwrap());
                }

                match response.bytes().await {
                    Ok(data) => {
                        let mut de =
                            rmp_serde::Deserializer::new(data.as_ref()).with_human_readable();
                        match T::deserialize(&mut de) {
                            Ok(data) => Ok(data),
                            Err(err) => Err(ApiHttpError::MsgpackDecode(err)),
                        }
                    }
                    Err(err) => Err(ApiHttpError::Reqwest(err)),
                }
            } else {
                Err(ApiHttpError::Http(
                    response.status(),
                    match response.bytes().await {
                        Ok(data) => {
                            let mut de =
                                rmp_serde::Deserializer::new(data.as_ref()).with_human_readable();
                            match super::ApiError::deserialize(&mut de) {
                                Ok(data) => data,
                                Err(err) => super::ApiError {
                                    error: err.to_string().into(),
                                },
                            }
                        }
                        Err(err) => super::ApiError {
                            error: err.to_string().into(),
                        },
                    },
                ))
            }
        }
        Err(err) => Err(ApiHttpError::Reqwest(err)),
    }
}

pub struct WingsClient {
    base_url: String,
    token: String,
}

impl WingsClient {

    #[inline]
    pub fn new(base_url: String, token: String) -> Self {
        Self { base_url, token }
    }

    pub fn request_raw(
        &self,
        method: Method,
        endpoint: impl AsRef<str>,
    ) -> reqwest::RequestBuilder {
        let url = format!(
            "{}/{}",
            self.base_url.trim_end_matches('/'),
            endpoint.as_ref().trim_start_matches('/')
        );
        let mut request = CLIENT.request(method, &url);

        if !self.token.is_empty() {
            request = request.header("Authorization", format!("Bearer {}", self.token));
        }

        request
    }

`)

for (const [name, schema] of Object.entries(openapi.components?.schemas || {})) {
    if (schema.$ref || name === 'CompactString') continue

    if (name === 'MiB') {
        output.write('pub type MiB = u64;\n\n')
        continue
    }

    generateSchemaObject(output, 0, null, name, schema as oas31.SchemaObject)
}

for (const [path, route] of Object.entries(openapi.paths ?? {})) {
    const methods = ['get', 'delete', 'post', 'put', 'patch'] as const
    if (!path.startsWith('/api')) continue

    output.write(`pub mod ${snakeCase(path).slice(4)} {\n`)
    output.write('    use super::*;\n')

    for (const method of methods) {
        const data = route[method]
        if (!data) continue

        output.write(`\n    pub mod ${method} {\n`)
        output.write('        use super::*;\n\n')

        if (data.requestBody) {
            const body = data.requestBody as oas31.RequestBodyObject
            const schema = Object.values(body.content)[0].schema
            if (schema?.$ref) {
                output.write(`        pub type RequestBody = ${schema.$ref.split('/').at(-1)};\n\n`)
            } else {
                if ((schema as oas31.SchemaObject).type !== 'object') {
                    output.write(`        pub type RequestBody = ${convertType(schema as any)};\n\n`)
                } else {
                    generateSchemaObject(output, 8, null, `RequestBody`, schema as any)
                }
            }
        }

        for (const [code, _response] of Object.entries(data.responses ?? [])) {
            const response = _response as oas31.ResponseObject
            const schema = Object.values(response.content ?? {})[0].schema
            if (schema?.$ref) {
                output.write(`        pub type Response${code} = ${schema.$ref.split('/').at(-1)};\n\n`)
            } else {
                if ((schema as oas31.SchemaObject).type !== 'object') {
                    output.write(`        pub type Response${code} = ${convertType(schema as any)};\n\n`.replace('compact_str::CompactString', 'String').replace('String', 'AsyncResponseReader'))
                } else {
                    generateSchemaObject(output, 8, null, `Response${code}`, schema as any)
                }
            }
        }

        if (Object.keys(data.responses ?? []).filter((code) => code.startsWith('2')).length > 1) {
            output.write('        #[derive(Deserialize)]\n')
            output.write('        #[serde(untagged)]\n')
            output.write('        pub enum Response {\n')

            for (const [code, _] of Object.entries(data.responses ?? [])) {
                if (!code.startsWith('2')) continue

                output.write(`            ${pascalCase(http.STATUS_CODES[parseInt(code)]!)}(Response${code}),\n`)
            }

            output.write('        }\n')
        } else {
            output.write(`        pub type Response = Response${Object.keys(data.responses ?? []).find((code) => code.startsWith('2'))};\n`)
        }

        {
            const params: string[] = []

            for (const param of (data.parameters ?? []) as oas31.ParameterObject[]) {
                const type = param.schema? convertType(param.schema) : 'compact_str::CompactString'
                params.push(`${param.name}: ${type === 'compact_str::CompactString' ? '&str' : type}`)
            }

            const body = data.requestBody
                ? (Object.values((data.requestBody as oas31.RequestBodyObject).content)[0].schema as oas31.SchemaObject).type === 'string'
                    ? 'None::<&()>, Some(data)'
                    : 'Some(data), None'
                : 'None::<&()>, None'

            if (data.requestBody) {
                if (body === 'None::<&()>, Some(data)') {
                    params.push(`data: super::${snakeCase(path).slice(4)}::${method}::RequestBody`)
                } else {
                    params.push(`data: &super::${snakeCase(path).slice(4)}::${method}::RequestBody`)
                }
            }

            clientOutput.write(`    pub async fn ${method}_${snakeCase(path).slice(4)}(&self${params.length ? `, ${params.join(', ')}` : ''})`)
            clientOutput.write(` -> Result<super::${snakeCase(path).slice(4)}::${method}::Response, ApiHttpError> {\n`)

            let query = ""
            for (const param of (data.parameters ?? []) as oas31.ParameterObject[]) {
                if (param.in === 'query') {
                    if (params.find((p) => p.startsWith(param.name))?.endsWith('&str')) {
                        clientOutput.write(`        let ${param.name} = urlencoding::encode(${param.name});\n`)
                    } else if (params.find((p) => p.startsWith(param.name))?.endsWith('Vec<compact_str::CompactString>')) {
                        clientOutput.write(`        let ${param.name} = ${param.name}.into_iter().map(|s| urlencoding::encode(&s).into()).collect::<Vec<compact_str::CompactString>>().join("&${param.name}=");\n`)
                    }

                    query += `${param.name}={${param.name}}&`
                }
            }

            if (query) {
                query = '?' + query.slice(0, -1)
            }

            let p = `format!("${path}${query}")`
            if (!p.includes('{')) {
                p = `"${path}${query}"`
            }

            clientOutput.write(`        request_impl(self, Method::${method.toUpperCase()}, ${p}, ${body}).await\n`)

            clientOutput.write('    }\n\n')
        }

        output.write(`    }\n`)
    }

    output.write('}\n')
}

clientOutput.write('}\n')
