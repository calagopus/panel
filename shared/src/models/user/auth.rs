use crate::response::ApiResponse;
use axum::http::StatusCode;
use std::{
    ops::{Deref, DerefMut},
    sync::{Arc, LazyLock},
};

#[derive(Clone)]
pub enum AuthMethod {
    Session(crate::models::user_session::UserSession),
    ApiKey(crate::models::user_api_key::UserApiKey),
}

impl AuthMethod {
    #[inline]
    pub fn api_key_uuid(&self) -> Option<uuid::Uuid> {
        match self {
            Self::Session(_) => None,
            Self::ApiKey(api_key) => Some(api_key.uuid),
        }
    }
}

#[derive(Clone)]
pub struct UserImpersonator(pub super::User);

impl Deref for UserImpersonator {
    type Target = super::User;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for UserImpersonator {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

pub type GetUser = crate::extract::ConsumingExtension<super::User>;
pub type GetUserImpersonator = crate::extract::ConsumingExtension<Option<UserImpersonator>>;
pub type GetAuthMethod = axum::extract::Extension<Arc<AuthMethod>>;
pub type GetPermissionManager = axum::extract::Extension<PermissionManager>;

static NO_PERMISSIONS: LazyLock<Arc<Vec<compact_str::CompactString>>> =
    LazyLock::new(|| Arc::new(Vec::new()));

#[derive(Clone)]
pub enum CredentialScope {
    Session,
    ApiKey {
        user: Arc<Vec<compact_str::CompactString>>,
        admin: Arc<Vec<compact_str::CompactString>>,
        server: Arc<Vec<compact_str::CompactString>>,
        unrestricted_admin: bool,
    },
}

impl From<&AuthMethod> for CredentialScope {
    fn from(auth: &AuthMethod) -> Self {
        match auth {
            AuthMethod::Session(_) => Self::Session,
            AuthMethod::ApiKey(api_key) => Self::ApiKey {
                user: Arc::clone(&api_key.user_permissions),
                admin: Arc::clone(&api_key.admin_permissions),
                server: Arc::clone(&api_key.server_permissions),
                unrestricted_admin: api_key.unrestricted_admin,
            },
        }
    }
}

impl CredentialScope {
    /// The server permissions this credential is limited to, or [`None`] when it is unscoped.
    #[inline]
    pub fn server_permissions(&self) -> Option<&[compact_str::CompactString]> {
        match self {
            Self::Session => None,
            Self::ApiKey { server, .. } => Some(server),
        }
    }

    #[inline]
    fn allows(scope: Option<&[compact_str::CompactString]>, permission: &str) -> bool {
        scope.is_none_or(|scope| scope.iter().any(|p| p == permission))
    }

    #[inline]
    fn allows_user(&self, permission: &str) -> bool {
        match self {
            Self::Session => true,
            Self::ApiKey { user, .. } => Self::allows(Some(user), permission),
        }
    }

    #[inline]
    fn allows_admin(&self, permission: &str) -> bool {
        match self {
            Self::Session => true,
            Self::ApiKey { admin, .. } => Self::allows(Some(admin), permission),
        }
    }

    #[inline]
    fn allows_server(&self, permission: &str) -> bool {
        Self::allows(self.server_permissions(), permission)
    }

    #[inline]
    pub fn is_session(&self) -> bool {
        matches!(self, Self::Session)
    }

    /// Sessions, and api keys an unrestricted administrator explicitly marked as such.
    #[inline]
    pub fn is_unrestricted(&self) -> bool {
        match self {
            Self::Session => true,
            Self::ApiKey {
                unrestricted_admin, ..
            } => *unrestricted_admin,
        }
    }

    /// Whether this credential is scoped to every given permission, so it cannot hand out more
    /// than it holds itself (e.g. when an api key creates another api key).
    pub fn covers(
        &self,
        user: &[compact_str::CompactString],
        admin: &[compact_str::CompactString],
        server: &[compact_str::CompactString],
    ) -> bool {
        user.iter().all(|p| self.allows_user(p))
            && admin.iter().all(|p| self.allows_admin(p))
            && server.iter().all(|p| self.allows_server(p))
    }
}

#[derive(Clone)]
pub struct PermissionManager {
    user_uuid: uuid::Uuid,
    user_admin: bool,
    role_admin_permissions: Arc<Vec<compact_str::CompactString>>,
    role_server_permissions: Arc<Vec<compact_str::CompactString>>,
    server_owner: bool,
    server_subuser_permissions: Arc<Vec<compact_str::CompactString>>,
    scope: CredentialScope,
    impersonated: bool,
}

impl PermissionManager {
    pub fn new(user: &super::User, scope: CredentialScope) -> Self {
        Self {
            user_uuid: user.uuid,
            user_admin: user.admin,
            role_admin_permissions: user.role.as_ref().map_or_else(
                || Arc::clone(&NO_PERMISSIONS),
                |role| Arc::clone(&role.admin_permissions),
            ),
            role_server_permissions: user.role.as_ref().map_or_else(
                || Arc::clone(&NO_PERMISSIONS),
                |role| Arc::clone(&role.server_permissions),
            ),
            server_owner: false,
            server_subuser_permissions: Arc::clone(&NO_PERMISSIONS),
            scope,
            impersonated: false,
        }
    }

    pub fn for_impersonation(self) -> Self {
        Self {
            impersonated: true,
            ..self
        }
    }

    /// Resolves the grants the user has on a specific server, replacing those of any server this
    /// manager was previously scoped to.
    pub fn for_server(&self, server: &crate::models::server::Server) -> Self {
        Self {
            server_owner: self.user_uuid == server.owner.uuid,
            server_subuser_permissions: server
                .subuser_permissions
                .as_ref()
                .map_or_else(|| Arc::clone(&NO_PERMISSIONS), Arc::clone),
            ..self.clone()
        }
    }

    #[inline]
    pub fn user_uuid(&self) -> uuid::Uuid {
        self.user_uuid
    }

    #[inline]
    pub fn scope(&self) -> &CredentialScope {
        &self.scope
    }

    #[inline]
    fn check(allowed: bool, permission: &str) -> Result<(), ApiResponse> {
        if allowed {
            return Ok(());
        }

        Err(ApiResponse::error(format!(
            "you do not have permission to perform this action: {permission}"
        ))
        .with_status(StatusCode::FORBIDDEN))
    }

    /// User permissions cover self-service on one's own account, which every account holds
    /// unconditionally, so the credential scope is the only thing that can withhold them.
    pub fn has_user_permission(&self, permission: &str) -> Result<(), ApiResponse> {
        Self::check(self.scope.allows_user(permission), permission)
    }

    pub fn has_admin_permission(&self, permission: &str) -> Result<(), ApiResponse> {
        let granted =
            self.user_admin || self.role_admin_permissions.iter().any(|p| p == permission);

        Self::check(granted && self.scope.allows_admin(permission), permission)
    }

    /// Whether this credential holds every given permission itself, so handing them to someone
    /// else (through a role, an oauth mapping or an account link) cannot escalate.
    pub fn can_grant(
        &self,
        admin: &[compact_str::CompactString],
        server: &[compact_str::CompactString],
    ) -> bool {
        admin.iter().all(|permission| {
            (self.user_admin || self.role_admin_permissions.contains(permission))
                && self.scope.allows_admin(permission)
        }) && server.iter().all(|permission| {
            (self.user_admin || self.role_server_permissions.contains(permission))
                && self.scope.allows_server(permission)
        })
    }

    /// Credentials and settings changed while impersonating would outlive the impersonation and
    /// act outside its audit trail, so only the account itself may change them.
    pub fn deny_while_impersonating(&self) -> Result<(), ApiResponse> {
        if !self.impersonated {
            return Ok(());
        }

        Err(
            ApiResponse::error("this cannot be modified while impersonating")
                .with_status(StatusCode::CONFLICT),
        )
    }

    /// Administrators may only be impersonated by an administrator signed in with a session;
    /// anyone else may only be impersonated by a caller who could grant their whole role.
    pub fn can_impersonate(&self, user: &super::User) -> bool {
        if user.admin {
            return self.is_unrestricted_admin();
        }

        user.role
            .as_ref()
            .is_none_or(|role| self.can_grant(&role.admin_permissions, &role.server_permissions))
    }

    /// Actions that could turn the caller into a full administrator (granting admin status,
    /// writing to or impersonating administrators, linking identities, changing how an oauth
    /// provider identifies users) need an administrator signed in with a session, because an api
    /// key scoped to a single admin permission would otherwise be enough, unless that key was
    /// explicitly marked as unrestricted.
    pub fn is_unrestricted_admin(&self) -> bool {
        self.user_admin && self.scope.is_unrestricted()
    }

    /// A linked identity signs in as the account from then on. Besides unrestricted administrators,
    /// a session may only link its own account, and an api key only through a provider an
    /// unrestricted administrator marked as api-linkable, for accounts it could impersonate.
    pub fn can_link_identity(&self, user: &super::User, api_linkable: bool) -> bool {
        if self.is_unrestricted_admin() {
            return true;
        }

        if self.scope.is_session() {
            return self.user_uuid == user.uuid;
        }

        api_linkable
            && self.has_admin_permission("users.impersonate").is_ok()
            && self.can_impersonate(user)
    }

    /// Administrators may only be written to by other administrators signed in with a session,
    /// no matter which admin permissions a role or api key grants.
    pub fn can_modify_user(&self, user: &super::User) -> Result<(), ApiResponse> {
        if self.is_unrestricted_admin() || !user.admin {
            return Ok(());
        }

        Err(ApiResponse::error("you cannot modify an administrator")
            .with_status(StatusCode::FORBIDDEN))
    }

    pub fn has_server_permission(&self, permission: &str) -> Result<(), ApiResponse> {
        let granted = self.user_admin
            || self.server_owner
            || self.role_server_permissions.iter().any(|p| p == permission)
            || self
                .server_subuser_permissions
                .iter()
                .any(|p| p == permission);

        Self::check(granted && self.scope.allows_server(permission), permission)
    }

    pub fn missing_server_permission<T: AsRef<str>>(
        &self,
        permissions: impl IntoIterator<Item = T>,
    ) -> Option<T> {
        permissions
            .into_iter()
            .find(|permission| self.has_server_permission(permission.as_ref()).is_err())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn permissions(permissions: &[&str]) -> Arc<Vec<compact_str::CompactString>> {
        Arc::new(permissions.iter().map(|p| (*p).into()).collect())
    }

    fn manager(scope: CredentialScope) -> PermissionManager {
        PermissionManager {
            user_uuid: uuid::Uuid::nil(),
            user_admin: false,
            role_admin_permissions: Arc::clone(&NO_PERMISSIONS),
            role_server_permissions: Arc::clone(&NO_PERMISSIONS),
            server_owner: false,
            server_subuser_permissions: Arc::clone(&NO_PERMISSIONS),
            scope,
            impersonated: false,
        }
    }

    fn api_key(user: &[&str], admin: &[&str], server: &[&str]) -> CredentialScope {
        CredentialScope::ApiKey {
            user: permissions(user),
            admin: permissions(admin),
            server: permissions(server),
            unrestricted_admin: false,
        }
    }

    fn unrestricted_api_key(user: &[&str], admin: &[&str], server: &[&str]) -> CredentialScope {
        CredentialScope::ApiKey {
            user: permissions(user),
            admin: permissions(admin),
            server: permissions(server),
            unrestricted_admin: true,
        }
    }

    fn user(admin: bool, role: Option<(&[&str], &[&str])>) -> super::super::User {
        super::super::User {
            uuid: uuid::Uuid::new_v4(),
            role: role.map(|(admin_permissions, server_permissions)| {
                serde_json::from_value(serde_json::json!({
                    "uuid": uuid::Uuid::new_v4(),
                    "name": "role",
                    "description": null,
                    "require_two_factor": false,
                    "admin_permissions": admin_permissions,
                    "server_permissions": server_permissions,
                    "created": chrono::NaiveDateTime::default(),
                    "extension_data": [],
                }))
                .unwrap()
            }),
            external_id: None,
            avatar: None,
            username: "user".into(),
            email: "user@example.com".into(),
            name_first: None,
            name_last: None,
            admin,
            frozen: false,
            suspended: false,
            totp_enabled: false,
            totp_last_used: None,
            totp_secret: None,
            email_two_factor_enabled: false,
            has_security_key: false,
            email_verified: true,
            password_login_disabled: false,
            language: "en".into(),
            has_password: true,
            created: chrono::NaiveDateTime::default(),
            extension_data: Vec::new(),
        }
    }

    #[test]
    fn api_key_scope_constrains_a_full_admin() {
        let mut manager = manager(api_key(&[], &["users.impersonate"], &[]));
        manager.user_admin = true;

        assert!(manager.has_admin_permission("users.impersonate").is_ok());
        assert!(manager.has_admin_permission("roles.read").is_err());
        assert!(manager.has_admin_permission("extensions.manage").is_err());
    }

    #[test]
    fn an_unconfigured_api_key_denies_everything() {
        let mut manager = manager(api_key(&[], &[], &[]));
        manager.user_admin = true;
        manager.server_owner = true;

        assert!(manager.has_user_permission("account.infos").is_err());
        assert!(manager.has_admin_permission("roles.read").is_err());
        assert!(manager.has_server_permission("files.read").is_err());
    }

    #[test]
    fn a_session_holds_every_user_permission() {
        let manager = manager(CredentialScope::Session);

        assert!(manager.has_user_permission("account.infos").is_ok());
        assert!(manager.has_user_permission("api-keys.create").is_ok());
    }

    #[test]
    fn a_session_still_defers_to_account_grants() {
        let manager = manager(CredentialScope::Session);

        assert!(manager.has_admin_permission("roles.read").is_err());
        assert!(manager.has_server_permission("files.read").is_err());
    }

    #[test]
    fn a_grant_and_a_scope_are_intersected() {
        let mut manager = manager(api_key(&[], &["roles.read"], &[]));
        manager.role_admin_permissions = permissions(&["roles.read", "nodes.read"]);

        assert!(manager.has_admin_permission("roles.read").is_ok());
        assert!(manager.has_admin_permission("nodes.read").is_err());
        assert!(manager.has_admin_permission("users.read").is_err());
    }

    #[test]
    fn a_scope_alone_grants_nothing() {
        let manager = manager(api_key(&[], &["roles.read"], &["files.read"]));

        assert!(manager.has_admin_permission("roles.read").is_err());
        assert!(manager.has_server_permission("files.read").is_err());
    }

    #[test]
    fn subuser_grants_are_scoped_too() {
        let mut manager = manager(api_key(&[], &[], &["files.read"]));
        manager.server_subuser_permissions = permissions(&["files.read", "files.delete"]);

        assert!(manager.has_server_permission("files.read").is_ok());
        assert!(manager.has_server_permission("files.delete").is_err());
    }

    #[test]
    fn server_ownership_is_scoped_too() {
        let mut manager = manager(api_key(&[], &[], &["files.read"]));
        manager.server_owner = true;

        assert!(manager.has_server_permission("files.read").is_ok());
        assert!(manager.has_server_permission("files.delete").is_err());
    }

    // CredentialScope::is_session
    #[test]
    fn only_a_session_is_a_session() {
        assert!(CredentialScope::Session.is_session());
        assert!(!api_key(&["account.infos"], &["roles.read"], &["files.read"]).is_session());
    }

    // PermissionManager::can_grant
    #[test]
    fn granting_nothing_is_always_allowed() {
        assert!(manager(CredentialScope::Session).can_grant(&[], &[]));
        assert!(manager(api_key(&[], &[], &[])).can_grant(&[], &[]));
    }

    #[test]
    fn an_admin_session_can_grant_anything() {
        let mut manager = manager(CredentialScope::Session);
        manager.user_admin = true;

        assert!(manager.can_grant(&["users.update".into()], &["files.delete".into()]));
    }

    #[test]
    fn an_admin_api_key_can_only_grant_what_it_lists() {
        let mut manager = manager(api_key(&[], &["roles.read"], &["files.read"]));
        manager.user_admin = true;

        assert!(manager.can_grant(&["roles.read".into()], &["files.read".into()]));
        assert!(!manager.can_grant(&["roles.read".into(), "users.update".into()], &[]));
        assert!(!manager.can_grant(&[], &["files.delete".into()]));
    }

    #[test]
    fn role_grants_bound_what_can_be_granted() {
        let mut manager = manager(CredentialScope::Session);
        manager.role_admin_permissions = permissions(&["roles.read"]);
        manager.role_server_permissions = permissions(&["files.read"]);

        assert!(manager.can_grant(&["roles.read".into()], &["files.read".into()]));
        assert!(!manager.can_grant(&["users.update".into()], &[]));
        assert!(!manager.can_grant(&[], &["files.delete".into()]));
    }

    #[test]
    fn server_ownership_and_subuser_grants_cannot_be_handed_on() {
        let mut manager = manager(CredentialScope::Session);
        manager.server_owner = true;
        manager.server_subuser_permissions = permissions(&["files.read"]);

        assert!(!manager.can_grant(&[], &["files.read".into()]));
        assert!(!manager.can_grant(&[], &["files.delete".into()]));
    }

    // PermissionManager::can_impersonate
    #[test]
    fn only_an_admin_session_can_impersonate_an_admin() {
        let mut session = manager(CredentialScope::Session);
        session.user_admin = true;
        let mut key = manager(api_key(
            &["account.infos"],
            &["users.impersonate"],
            &["files.read"],
        ));
        key.user_admin = true;

        assert!(session.can_impersonate(&user(true, None)));
        assert!(!key.can_impersonate(&user(true, None)));
        assert!(!manager(CredentialScope::Session).can_impersonate(&user(true, None)));
    }

    #[test]
    fn a_target_without_a_role_can_be_impersonated() {
        assert!(manager(CredentialScope::Session).can_impersonate(&user(false, None)));
        assert!(manager(api_key(&[], &[], &[])).can_impersonate(&user(false, None)));
    }

    #[test]
    fn a_target_role_must_be_grantable_by_the_caller() {
        let mut manager = manager(api_key(
            &[],
            &["roles.read", "users.impersonate"],
            &["files.read"],
        ));
        manager.user_admin = true;

        assert!(manager.can_impersonate(&user(false, Some((&["roles.read"], &["files.read"])))));
        assert!(!manager.can_impersonate(&user(false, Some((&["users.update"], &[])))));
        assert!(!manager.can_impersonate(&user(false, Some((&[], &["files.delete"])))));
    }

    #[test]
    fn a_non_admin_cannot_impersonate_a_stronger_role() {
        let mut manager = manager(CredentialScope::Session);
        manager.role_admin_permissions = permissions(&["users.impersonate"]);

        assert!(manager.can_impersonate(&user(false, Some((&["users.impersonate"], &[])))));
        assert!(!manager.can_impersonate(&user(
            false,
            Some((&["users.impersonate", "users.update"], &[]))
        )));
    }

    // PermissionManager::is_unrestricted_admin
    #[test]
    fn only_an_admin_session_or_flagged_admin_key_is_unrestricted() {
        let mut session = manager(CredentialScope::Session);
        session.user_admin = true;
        let mut key = manager(api_key(
            &["account.infos"],
            &["roles.read", "servers.read", "users.update"],
            &["files.read"],
        ));
        key.user_admin = true;
        let mut flagged = manager(unrestricted_api_key(&[], &[], &[]));
        flagged.user_admin = true;
        let flagged_non_admin = manager(unrestricted_api_key(&[], &[], &[]));
        let mut role = manager(CredentialScope::Session);
        role.role_admin_permissions = permissions(&["roles.read", "servers.read", "users.update"]);

        assert!(session.is_unrestricted_admin());
        assert!(flagged.is_unrestricted_admin());
        assert!(!key.is_unrestricted_admin());
        assert!(!flagged_non_admin.is_unrestricted_admin());
        assert!(!role.is_unrestricted_admin());
    }

    #[test]
    fn an_unrestricted_admin_key_keeps_its_scope() {
        let mut manager = manager(unrestricted_api_key(&[], &["users.update"], &[]));
        manager.user_admin = true;

        assert!(manager.has_admin_permission("users.update").is_ok());
        assert!(manager.has_admin_permission("roles.read").is_err());
    }

    // PermissionManager::deny_while_impersonating
    #[test]
    fn impersonation_is_denied_with_a_conflict() {
        assert!(
            manager(CredentialScope::Session)
                .deny_while_impersonating()
                .is_ok()
        );
        assert_eq!(
            manager(CredentialScope::Session)
                .for_impersonation()
                .deny_while_impersonating()
                .unwrap_err()
                .status,
            StatusCode::CONFLICT
        );
    }

    // PermissionManager::for_impersonation
    #[test]
    fn impersonation_keeps_the_same_grants() {
        let mut manager = manager(api_key(
            &["account.infos"],
            &["roles.read"],
            &["files.read"],
        ));
        manager.role_admin_permissions = permissions(&["roles.read", "nodes.read"]);
        manager.role_server_permissions = permissions(&["files.read", "files.delete"]);
        let manager = manager.for_impersonation();

        assert!(manager.has_user_permission("account.infos").is_ok());
        assert!(manager.has_user_permission("api-keys.create").is_err());
        assert!(manager.has_admin_permission("roles.read").is_ok());
        assert!(manager.has_admin_permission("nodes.read").is_err());
        assert!(manager.has_server_permission("files.read").is_ok());
        assert!(manager.has_server_permission("files.delete").is_err());
    }

    // PermissionManager::can_modify_user
    #[test]
    fn anyone_may_modify_a_non_admin() {
        assert!(
            manager(CredentialScope::Session)
                .can_modify_user(&user(false, Some((&["roles.read"], &[]))))
                .is_ok()
        );
        assert!(
            manager(api_key(&[], &[], &[]))
                .can_modify_user(&user(false, None))
                .is_ok()
        );
    }

    #[test]
    fn only_an_unrestricted_admin_may_modify_an_admin() {
        let mut session = manager(CredentialScope::Session);
        session.user_admin = true;
        let mut flagged = manager(unrestricted_api_key(&[], &["users.update"], &[]));
        flagged.user_admin = true;
        let mut key = manager(api_key(&["account.infos"], &["users.update"], &[]));
        key.user_admin = true;
        let mut role = manager(CredentialScope::Session);
        role.role_admin_permissions = permissions(&["users.update"]);

        assert!(session.can_modify_user(&user(true, None)).is_ok());
        assert!(flagged.can_modify_user(&user(true, None)).is_ok());
        assert_eq!(
            key.can_modify_user(&user(true, None)).unwrap_err().status,
            StatusCode::FORBIDDEN
        );
        assert_eq!(
            role.can_modify_user(&user(true, None)).unwrap_err().status,
            StatusCode::FORBIDDEN
        );
    }

    // PermissionManager::missing_server_permission
    #[test]
    fn nothing_is_missing_when_everything_is_held() {
        let mut manager = manager(CredentialScope::Session);
        manager.server_subuser_permissions = permissions(&["files.read"]);
        manager.role_server_permissions = permissions(&["files.delete"]);

        assert_eq!(
            manager.missing_server_permission(["files.read", "files.delete"]),
            None
        );
        assert_eq!(manager.missing_server_permission::<&str>([]), None);
    }

    #[test]
    fn the_first_missing_permission_is_reported() {
        let mut manager = manager(CredentialScope::Session);
        manager.server_subuser_permissions = permissions(&["files.read"]);

        assert_eq!(
            manager.missing_server_permission(["files.read", "files.delete", "files.create"]),
            Some("files.delete")
        );
    }

    #[test]
    fn missing_permissions_respect_the_scope() {
        let mut manager = manager(api_key(&[], &[], &["files.read"]));
        manager.server_owner = true;

        assert_eq!(manager.missing_server_permission(["files.read"]), None);
        assert_eq!(
            manager.missing_server_permission(["files.read", "files.delete"]),
            Some("files.delete")
        );
    }

    // PermissionManager::can_link_identity
    #[test]
    fn an_admin_session_can_link_any_identity() {
        let mut manager = manager(CredentialScope::Session);
        manager.user_admin = true;

        assert!(manager.can_link_identity(&user(true, None), false));
        assert!(manager.can_link_identity(&user(true, None), true));
        assert!(manager.can_link_identity(&user(false, Some((&["users.update"], &[]))), false));
    }

    #[test]
    fn a_role_session_can_only_link_its_own_account() {
        let target = user(false, None);
        let mut manager = manager(CredentialScope::Session);
        manager.role_admin_permissions = permissions(&["users.oauth-links", "users.impersonate"]);

        assert!(!manager.can_link_identity(&target, true));
        assert!(!manager.can_link_identity(&target, false));

        manager.user_uuid = target.uuid;
        assert!(manager.can_link_identity(&target, false));
        assert!(manager.can_link_identity(&target, true));
    }

    #[test]
    fn an_api_key_needs_the_linkable_flag() {
        let mut manager = manager(api_key(&[], &["users.impersonate"], &[]));
        manager.user_admin = true;

        assert!(manager.can_link_identity(&user(false, None), true));
        assert!(!manager.can_link_identity(&user(false, None), false));
    }

    #[test]
    fn an_api_key_needs_impersonate_granted_and_scoped() {
        let mut unscoped = manager(api_key(&[], &["users.oauth-links"], &[]));
        unscoped.user_admin = true;
        let ungranted = manager(api_key(&[], &["users.impersonate"], &[]));
        let mut role = manager(api_key(&[], &["users.impersonate"], &[]));
        role.role_admin_permissions = permissions(&["users.impersonate"]);

        assert!(!unscoped.can_link_identity(&user(false, None), true));
        assert!(!ungranted.can_link_identity(&user(false, None), true));
        assert!(role.can_link_identity(&user(false, None), true));
    }

    #[test]
    fn an_api_key_cannot_link_an_admin() {
        let mut manager = manager(api_key(
            &["account.infos"],
            &["users.impersonate"],
            &["files.read"],
        ));
        manager.user_admin = true;

        assert!(!manager.can_link_identity(&user(true, None), true));
    }

    #[test]
    fn an_api_key_cannot_link_a_stronger_role() {
        let mut manager = manager(api_key(
            &[],
            &["users.impersonate", "roles.read"],
            &["files.read"],
        ));
        manager.role_admin_permissions =
            permissions(&["users.impersonate", "roles.read", "users.update"]);
        manager.role_server_permissions = permissions(&["files.read", "files.delete"]);

        assert!(
            manager.can_link_identity(&user(false, Some((&["roles.read"], &["files.read"]))), true)
        );
        assert!(!manager.can_link_identity(&user(false, Some((&["users.update"], &[]))), true));
        assert!(!manager.can_link_identity(&user(false, Some((&[], &["files.delete"]))), true));
        assert!(!manager.can_link_identity(&user(false, Some((&["nodes.read"], &[]))), true));
    }

    #[test]
    fn an_api_key_gets_no_exemption_for_its_own_account() {
        let target = user(false, None);
        let mut flagless = manager(api_key(&[], &["users.impersonate"], &[]));
        flagless.user_admin = true;
        flagless.user_uuid = target.uuid;
        let mut unscoped = manager(api_key(&[], &[], &[]));
        unscoped.user_admin = true;
        unscoped.user_uuid = target.uuid;

        assert!(!flagless.can_link_identity(&target, false));
        assert!(!unscoped.can_link_identity(&target, true));
    }
}
