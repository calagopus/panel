import { pascalCase } from "change-case"
import fs from "fs"
import { oas31 } from "openapi3-ts"
import generateSchemaProperty, { convertType } from "@/generate-schema-property"

export default function generateSchemaObject(output: fs.WriteStream, _spaces: number, parent: string | null, name: string, object: oas31.SchemaObject, inlined: boolean = false) {
    const spaces = ' '.repeat(_spaces)

    if (object.enum) {
        output.write(`${spaces}#[derive(Debug, ToSchema, Deserialize, Serialize, Clone, Copy)]\n`)
        output.write(`${spaces}pub enum ${name} {\n`)
        for (const value of object.enum) {
            output.write(`${spaces}    #[serde(rename = "${value}")]\n`)
            output.write(`${spaces}    ${pascalCase(value)},\n`)
        }

        output.write(`}\n\n`)
    } else {
        if (object.additionalProperties) {
            if (object.propertyNames && !object.propertyNames.$ref && (object.propertyNames as oas31.SchemaObject).format === 'uuid') {
                if (!parent) {
                output.write(`${spaces}type ${pascalCase(name)} = IndexMap<uuid::Uuid, ${convertType(object.additionalProperties as any)}>;\n`)
                } else {
                    output.write(`IndexMap<uuid::Uuid, ${convertType(object.additionalProperties as any)}>,\n`)
                }
            } else {
                if (!parent) {
                    output.write(`${spaces}type ${pascalCase(name)} = IndexMap<compact_str::CompactString, ${convertType(object.additionalProperties as any)}>;\n`)
                } else {
                    output.write(`IndexMap<compact_str::CompactString, ${convertType(object.additionalProperties as any)}>,\n`)
                }
            }

            return
        }

        if (!parent) output.write(`${spaces}nestify::nest! {\n`)
        output.write(`${parent ? '' : spaces + '    '}#[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct ${pascalCase(name)} {\n`)

        if (object.properties) {
            for (const [propertyName, property] of Object.entries(object.properties)) {
                const p = parent?.startsWith(pascalCase(name)) ? parent?.replace(pascalCase(name), '') ?? '' : pascalCase(name)
                generateSchemaProperty(output, _spaces + (parent ? 0 : 8), p, propertyName, property)
            }
        }

        if (!parent) output.write(`${spaces}    }\n`)
        if (inlined) output.write(`${parent ? spaces.slice(0, -4) : spaces}}`)
        else output.write(`${parent ? spaces.slice(0, -4) : spaces}}${parent ? ',' : ''}\n\n`)
    }
}
