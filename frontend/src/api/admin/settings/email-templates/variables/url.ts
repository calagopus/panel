export const emailVariablesUrl = (templateIdentifier: string | null): string =>
  templateIdentifier === null
    ? '/api/admin/system/email/variables'
    : `/api/admin/system/email/templates/${templateIdentifier}/variables`;
