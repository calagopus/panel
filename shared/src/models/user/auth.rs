use crate::response::ApiResponse;
use axum::http::StatusCode;
use std::{
    ops::{Deref, DerefMut},
    sync::Arc,
};

#[derive(Clone)]
pub enum AuthMethod {
    Session(crate::models::user_session::UserSession),
    ApiKey(crate::models::user_api_key::UserApiKey),
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
pub type GetAuthMethod = crate::extract::ConsumingExtension<AuthMethod>;
pub type GetPermissionManager = axum::extract::Extension<PermissionManager>;

#[derive(Clone)]
pub struct PermissionManager {
    user_admin: bool,
    user_server_owner: bool,
    role_admin_permissions: Option<Arc<Vec<compact_str::CompactString>>>,
    role_server_permissions: Option<Arc<Vec<compact_str::CompactString>>>,
    api_key_user_permissions: Option<Arc<Vec<compact_str::CompactString>>>,
    api_key_admin_permissions: Option<Arc<Vec<compact_str::CompactString>>>,
    api_key_server_permissions: Option<Arc<Vec<compact_str::CompactString>>>,
    server_subuser_permissions: Option<Arc<Vec<compact_str::CompactString>>>,
}

impl PermissionManager {
    pub fn new(user: &super::User) -> Self {
        Self {
            user_admin: user.admin,
            user_server_owner: false,
            role_admin_permissions: user.role.as_ref().map(|r| r.admin_permissions.clone()),
            role_server_permissions: user.role.as_ref().map(|r| r.server_permissions.clone()),
            api_key_user_permissions: None,
            api_key_admin_permissions: None,
            api_key_server_permissions: None,
            server_subuser_permissions: None,
        }
    }

    pub fn add_api_key(mut self, api_key: &crate::models::user_api_key::UserApiKey) -> Self {
        self.api_key_user_permissions = Some(api_key.user_permissions.clone());
        self.api_key_admin_permissions = Some(api_key.admin_permissions.clone());
        self.api_key_server_permissions = Some(api_key.server_permissions.clone());
        self
    }

    pub fn set_user_server_owner(mut self, is_owner: bool) -> Self {
        self.user_server_owner = is_owner;
        self
    }

    pub fn add_subuser_permissions(
        mut self,
        permissions: Option<Arc<Vec<compact_str::CompactString>>>,
    ) -> Self {
        self.server_subuser_permissions = permissions;
        self
    }

    pub fn has_user_permission(&self, permission: &str) -> Result<(), ApiResponse> {
        if let Some(api_key_permissions) = &self.api_key_user_permissions
            && !api_key_permissions.iter().any(|p| p == permission)
        {
            return Err(ApiResponse::error(format!(
                "you do not have permission to perform this action: {permission}"
            ))
            .with_status(StatusCode::FORBIDDEN));
        }

        Ok(())
    }

    pub fn has_admin_permission(&self, permission: &str) -> Result<(), ApiResponse> {
        let is_admin = self.user_admin;
        let has_role_perm = self
            .role_admin_permissions
            .as_ref()
            .is_some_and(|perms| perms.iter().any(|p| p == permission));

        let has_base_permission = is_admin || has_role_perm;

        if !has_base_permission {
            return Err(ApiResponse::error(format!(
                "you do not have permission to perform this action: {permission}"
            ))
            .with_status(StatusCode::FORBIDDEN));
        }

        if let Some(api_key_permissions) = &self.api_key_admin_permissions
            && !api_key_permissions.iter().any(|p| p == permission)
        {
            return Err(ApiResponse::error(format!(
                "you do not have permission to perform this action: {permission}"
            ))
            .with_status(StatusCode::FORBIDDEN));
        }

        Ok(())
    }

    pub fn has_server_permission(&self, permission: &str) -> Result<(), ApiResponse> {
        let is_admin = self.user_admin;

        let has_role_perm = self
            .role_server_permissions
            .as_ref()
            .is_some_and(|perms| perms.iter().any(|p| p == permission));

        let is_owner = self.user_server_owner;

        let has_subuser_perm = self
            .server_subuser_permissions
            .as_ref()
            .is_some_and(|perms| perms.iter().any(|p| p == permission));

        let has_base_permission = is_admin || has_role_perm || is_owner || has_subuser_perm;

        if !has_base_permission {
            return Err(ApiResponse::error(format!(
                "you do not have permission to perform this action: {permission}"
            ))
            .with_status(StatusCode::FORBIDDEN));
        }

        if let Some(api_key_permissions) = &self.api_key_server_permissions
            && !api_key_permissions.iter().any(|p| p == permission)
        {
            return Err(ApiResponse::error(format!(
                "you do not have permission to perform this action: {permission}"
            ))
            .with_status(StatusCode::FORBIDDEN));
        }

        Ok(())
    }
}
