import { DefinedTranslations, defineEnglishItem, defineTranslations } from 'shared';

let extensionTranslations: Record<string, unknown> = {};
try {
  extensionTranslations = import.meta.glob('../extensions/*/src/translations.ts', { eager: true });
} catch {
  // Ignore
}

const baseTranslations = defineTranslations({
  items: {
    user: defineEnglishItem('User', 'Users'),
    file: defineEnglishItem('File', 'Files'),
    server: defineEnglishItem('Server', 'Servers'),
    sshKey: defineEnglishItem('SSH Key', 'SSH Keys'),
  },
  translations: {
    common: {
      button: {
        create: 'Create',
        add: 'Add',
        save: 'Save',
        saveAndStay: 'Save & Stay',
        edit: 'Edit',
        delete: 'Delete',
        remove: 'Remove',
        enable: 'Enable',
        disable: 'Disable',
        update: 'Update',
        close: 'Close',
        cancel: 'Cancel',
        continue: 'Continue',
        skip: 'Skip',
        okay: 'Okay',
        back: 'Back',
        next: 'Next',
        install: 'Install',
        selectAll: 'Select All',
        deselectAll: 'Deselect All',
        restore: 'Restore',
        download: 'Download',
        downloadAs: 'Download as {format}',
        export: 'Export',
        exportAs: 'Export as {format}',
      },
      alert: {
        error: 'Error',
        warning: 'Warning',
        success: 'Success',
      },
      divider: {
        or: 'OR',
      },
      input: {
        search: 'Search...',
      },
      tooltip: {
        resetToDefault: 'Reset to default',
        edit: 'Edit',
        delete: 'Delete',
      },
      form: {
        name: 'Name',
        description: 'Description',
        password: 'Password',
        host: 'Host',
        username: 'Username',
        server: 'Server',
        truncateDirectory:
          'Do you want to delete all files of this server before performing this action? This cannot be undone.',
      },
      table: {
        pagination: {
          results: 'Showing {start} to {end} of {total} results.',
          empty: "No items could be found, it's almost like they are hiding.",
        },
        columns: {
          name: 'Name',
          description: 'Description',
          username: 'Username',
          size: 'Size',
          lastUsed: 'Last Used',
          created: 'Created',
          actor: 'Actor',
          event: 'Event',
          ip: 'IP',
          when: 'When',
          command: 'Command',
        },
      },
      badge: {
        active: 'Active',
        inactive: 'Inactive',
        enabled: 'Enabled',
        disabled: 'Disabled',
        successful: 'Successful',
        failed: 'Failed',
      },
      server: {
        noAllocation: 'No Allocation',
        state: {
          suspended: 'Suspended',
          transferring: 'Server is being transferred',
          nodeMaintenance: 'Node is under Maintenance',
          restoringBackup: 'Restoring Backup',
          installing: 'Installing',
          installFailed: 'Install Failed',
        },
      },
      enum: {
        userToastPosition: {
          topLeft: 'Top Left',
          topCenter: 'Top Center',
          topRight: 'Top Right',
          bottomLeft: 'Bottom Left',
          bottomCenter: 'Bottom Center',
          bottomRight: 'Bottom Right',
        },
        serverState: {
          unknown: 'Unknown',
          offline: 'Offline',
          running: 'Running',
          starting: 'Starting',
          stopping: 'Stopping',
        },
        connectionStatus: {
          connected: 'Connected',
          offline: 'Offline',
        },
        serverAutoStartBehavior: {
          always: 'Always',
          unlessStopped: 'Unless Stopped',
          never: 'Never',
        },
        bulkActionServerAction: {
          started: 'Started',
          stopped: 'Stopped',
          restarted: 'Restarted',
          killed: 'Killed',
        },
      },
      unlimited: 'Unlimited',
      readOnly: 'Read-Only',
      na: 'N/A',
      never: 'Never',
      yes: 'Yes',
      no: 'No',
      web: 'Web',
      api: 'API',
      system: 'System',
      schedule: 'Schedule',
      impersonatedBy: 'Impersonated by {username}',
    },
    elements: {
      errorBoundary: {
        message: 'An error was encountered by the application while rendering this view. Try refreshing the page.',
        hideDetails: 'Hide Details',
        showDetails: 'Show Details',
        errorMessage: 'Error Message:',
        stackTrace: 'Stack Trace:',
        componentStack: 'Component Stack:',
      },
      copyOnClick: {
        toast: {
          copied: 'Copied to clipboard.',
          failed: 'Failed to copy to clipboard.',
          copyManual: 'Copy to clipboard: Ctrl+C or Command+C, Enter',
        },
      },
      estimatedTimeArrival: {
        tooltip: {
          estimating: 'Estimating completion time...',
          estimated: 'Estimated completion time: {time}',
        },
        calculating: 'ETA: Calculating...',
        calculated: 'ETA: {time}',
      },
      container: {
        alert: {
          impersonating:
            'You are currently impersonating a user. Please be aware that your actions may affect the impersonated user\'s account. To exit impersonation mode, click the "Stop Impersonating" button in the bottom left corner.',
        },
      },
      sidebar: {
        button: {
          logout: 'Logout',
          stopImpersonating: 'Stop Impersonating',
        },
      },
      permissionSelector: {
        selectedPermissions: 'Selected Permissions ({count})',
        noPermissions: 'No permissions selected.',
      },
      can: {
        tooltip: {
          cantSave: 'You do not have permission to save.',
          cantDelete: 'You do not have permission to delete.',
        },
      },
      activityInfoButton: {
        modal: {
          info: {
            title: 'Activity Details',
          },
        },
      },
      screenBlock: {
        permissionDenied: {
          title: 'Permission Denied',
          content: 'You do not have permission to access this page.',
        },
        notFound: {
          title: 'Not Found',
          content: 'The page you are looking for could not be found.',
        },
        serverConflict: {
          title: 'Conflicting Server State',
          contentSuspended: 'This server is suspended and cannot be accessed.',
          contentNodeMaintenance:
            'This server is on a node that is currently under maintenance and cannot be accessed.',
          contentTransferring:
            'This server is currently being transferred and cannot be accessed until the transfer is complete.',
          contentInstallFailed: 'This server failed to install and cannot be accessed until acknowledged.',
          contentInstalling: 'This server is currently installing and cannot be accessed until completed.',
          contentRestoringBackup:
            'This server is currently restoring from a backup and cannot be accessed until completed.',
          button: {
            viewInstallLogs: 'View Installation Logs',
            acknowledgeFailure: 'Acknowledge Failure',
          },
          modal: {
            acknowledgeFailure: {
              title: 'Acknowledge Installation Failure',
              content:
                'By acknowledging this installation failure, you are confirming that you are aware of the failed installation and have taken any necessary steps to resolve the issue. This will allow you to regain control over the server.',
            },
          },
        },
      },
      serverWebsocket: {
        error: {
          connectionFailed: 'Unable to connect after multiple attempts. Please refresh the page.',
          connectionClosed: 'Connection to server was closed. Attempting to reconnect...',
          connectionRetry: 'Connection lost. Retrying (attempt {attempt})...',
          authFailed: 'Authentication failed. Attempting to refresh credentials...',
          authRefreshFailed: 'Failed to refresh credentials. Please refresh the page to try again.',
          permissionRevoked: 'Connection closed: your access to this server has been revoked.',
          tokenRefreshLoop: 'Authentication loop detected. Please refresh the page to try again.',
        },
        banner: {
          retrying: 'Retrying in {countdown}...',
        },
        listener: {
          toast: {
            backupCompleted: 'Backup completed successfully.',
            backupFailed: 'Backup failed.',
            backupRestoreCompleted: 'Backup restore completed successfully.',
            installCompleted: 'Server Installation completed successfully.',
            installFailed: 'Server Installation failed.',
            operations: {
              compressing: {
                completed: 'Compressed {files} to `{path}` in {time}.',
                failed: 'Failed to compress {files} to `{path}`:\n{error}',
              },
              decompressing: {
                completed: 'Decompressed `{path}` to `{destination}` in {time}.',
                failed: 'Failed to decompress `{path}` to `{destination}`:\n{error}',
              },
              pulling: {
                completed: 'Pulled `{destination}` in {time}.',
                failed: 'Failed to pull `{destination}`:\n{error}',
              },
              copying: {
                completed: 'Copied `{path}` to `{destination}` in {time}.',
                failed: 'Failed to copy `{path}` to `{destination}`:\n{error}',
              },
              copyingMany: {
                completed: 'Copied {files} in {time}.',
                failed: 'Failed to copy {files}:\n{error}',
              },
              copyingRemote: {
                completedFrom: 'Copied {files} from remote server  in {time}.',
                completedTo: 'Copied {files} to remote server in {time}.',
                failedFrom: 'Failed to copy {files} from remote server:\n{error}',
                failedTo: 'Failed to copy {files} to remote server:\n{error}',
              },
            },
          },
        },
      },
    },
    pages: {
      oobe: {
        welcome: {
          title: 'Welcome to Calagopus',
          subtitle: "Let's get your game server management system up and running!",
          wizardIntro: 'This setup wizard will guide you through:',
          steps: {
            account: 'Creating your administrator account',
            settings: 'Configuring essential system settings',
            location: 'Setting up your server location',
            node: 'Adding your first node',
            server: 'Deploying your first game server',
          },
          button: {
            start: 'Get Started',
          },
        },
        register: {
          title: 'Create Administrator Account',
          alert: {
            title: 'Security Notice',
            description:
              'Choose a strong password. This account will have complete administrative access to all servers and settings.',
          },
          form: {
            username: 'Username',
            usernamePlaceholder: 'admin',
            email: 'Email Address',
            emailPlaceholder: 'admin@example.com',
            firstName: 'First Name',
            firstNamePlaceholder: 'Alan',
            lastName: 'Last Name',
            lastNamePlaceholder: 'Turing',
            password: 'Password',
            passwordPlaceholder: 'Enter a strong password',
            confirmPassword: 'Confirm Password',
            confirmPasswordPlaceholder: 'Re-enter your password',
          },
          button: {
            create: 'Create Account & Continue',
          },
        },
        login: {
          title: 'Log back in',
          alert: 'You got logged out during the setup process. Please log back in to continue where you left off.',
          form: {
            username: 'Username',
            usernamePlaceholder: 'admin',
            password: 'Password',
            passwordPlaceholder: 'Enter a strong password',
          },
          button: {
            login: 'Log in & Continue',
          },
        },
        location: {
          title: 'Location Configuration',
          form: {
            locationName: 'Location Name',
            locationNamePlaceholder: 'My home',
            backupName: 'Backup Configuration Name',
            backupNamePlaceholder: 'Unicorn Cloud',
            backupDisk: 'Backup Disk',
            backupDiskPlaceholder: 'Backup Disk',
          },
          button: {
            create: 'Create & Continue',
          },
        },
        node: {
          title: 'Node Configuration',
          form: {
            name: 'Name',
            namePlaceholder: 'My Server',
            url: 'URL',
            urlPlaceholder: 'URL',
            urlDescription: 'used for internal communication with the node',
            publicUrl: 'Public URL',
            publicUrlPlaceholder: 'URL',
            publicUrlDescription: 'used for websocket/downloads',
            sftpHost: 'SFTP Host',
            sftpHostPlaceholder: 'SFTP Host',
            sftpPort: 'SFTP Port',
            sftpPortPlaceholder: 'SFTP Port',
            memory: 'Memory',
            disk: 'Disk',
          },
          error: {
            noLocations: 'Something went wrong. No locations were found.',
          },
          button: {
            create: 'Create & Continue',
          },
        },
        configuration: {
          title: 'Application Settings',
          form: {
            applicationName: 'Application Name',
            applicationNamePlaceholder: 'Calagopus',
            language: 'Language',
            languagePlaceholder: 'Language',
            applicationUrl: 'Application URL',
            applicationUrlPlaceholder: 'https://calagop.us',
            telemetry: 'Enable Telemetry',
            telemetryDescription:
              'Allow Calagopus to collect limited and anonymous usage data to help improve the application.',
            registration: 'Enable Registration',
            registrationDescription: 'Allow new users to register their own account.',
          },
          button: {
            submit: 'Update Settings & Continue',
          },
        },
        finished: {
          title: 'Setup Complete!',
          subtitle: 'Your Calagopus panel is ready to use',
          setupTitle: "What We've Set Up",
          items: {
            account: 'Administrator Account',
            configuration: {
              title: 'System Configuration',
              subtitle: 'Panel settings and preferences configured',
            },
            location: 'Location',
            node: 'Node',
          },
          badge: {
            skipped: 'Skipped',
          },
          button: 'Go to Dashboard',
        },
      },
      auth: {
        button: {
          login: 'Login',
          loginWith: 'Login with {name}',
        },
        login: {
          alert: {
            clockOffset:
              'Your system clock is out of sync with the server by more than 5 seconds. This may cause issues with passkey authentication and two-factor authentication. Please sync your clock if issues arise. Current offset: {offset} seconds.',
          },
          error: {
            usernameRequired: 'Please enter a username',
          },
          passkey: {
            error: {
              notSupported: 'Your browser does not support passkeys.',
              unexpected: 'An unexpected error occurred while using your passkey.',
              cancelled: 'Passkey request was cancelled.',
              dismissed:
                'You dismissed or did not interact with the passkey prompt. The used key could also be not registered.',
              invalidState: 'This passkey is not available or already registered.',
              notSupportedType: 'Your browser or device does not support this type of passkey.',
              securityError: 'Passkeys can only be used over HTTPS and with a valid domain.',
              authenticatorError: 'Something went wrong with the authenticator.',
              constraintError: 'The authenticator could not meet the required constraints.',
            },
          },
          step: {
            username: {
              title: 'Login',
              subtitle: 'Enter your username to continue',
              form: {
                usernamePlaceholder: 'Enter your username',
              },
              link: {
                forgotPassword: 'Forgot Password',
                notRegistered: 'Not registered?',
                createAccount: 'Create account',
              },
              button: {
                oauthLogin: 'OAuth Login',
              },
            },
            passkey: {
              title: 'Authenticate with Passkey',
              subtitle: 'We found a passkey associated with {username}',
              button: {
                usePasskey: 'Use Passkey',
                usePassword: 'Use Password',
              },
            },
            password: {
              title: 'Enter Password',
              subtitle: 'Please enter your password for {username}',
              form: {
                passwordPlaceholder: 'Enter your password',
              },
              button: {
                signIn: 'Sign In',
                forgotPassword: 'Forgot Password',
              },
            },
            totp: {
              title: 'Two-Factor Authentication',
              welcomeBack: 'Welcome back {username}!',
              enterCode: 'Enter the 6-digit code from your authenticator app',
              button: {
                verify: 'Verify Code',
                useRecoveryCode: 'Use Recovery Code',
                useTotp: 'Use TOTP',
              },
            },
            totpRecovery: {
              subtitle: 'Enter a recovery code',
              form: {
                label: 'Recovery Code',
                placeholder: 'Enter a recovery code',
              },
            },
          },
        },
        register: {
          title: 'Register',
          subtitle: 'Please enter your details to register',
          form: {
            email: 'Email',
            firstName: 'First Name',
            lastName: 'Last Name',
          },
          button: {
            register: 'Register',
          },
        },
        forgotPassword: {
          title: 'Forgot Password',
          subtitle: 'Enter your email to receive instructions on how to reset your password',
          form: {
            email: 'Email',
          },
          button: {
            request: 'Request Password Reset',
          },
          success: 'An email has been sent to you with instructions on how to reset your password.',
        },
        resetPassword: {
          title: 'Reset Password',
          subtitle: 'Please enter your new password',
          form: {
            confirmPassword: 'Confirm Password',
          },
          button: {
            reset: 'Reset Password',
          },
          toast: {
            success: 'Password has been reset.',
          },
        },
        oauth: {
          title: 'Authenticate with OAuth',
          subtitle: 'Choose any of the providers below to login',
        },
      },
      account: {
        home: {
          title: 'Servers',
          tooltip: {
            removeFromGroup: 'Remove from Group',
            addToGroup: 'Add to Group',
            addServerToGroup: 'Add Server to Group',
            groupActions: 'Group Actions',
            noGroups: 'No groups available to add server to',
            noGroup: 'This server is not in any group',
          },
          tabs: {
            groupedServers: {
              title: 'Grouped Servers',
              page: {
                button: {
                  createGroup: 'Create Group',
                },
                modal: {
                  createServerGroup: {
                    title: 'Create Server Group',
                    toast: {
                      created: 'Server group created.',
                    },
                  },
                  editServerGroup: {
                    title: 'Edit Server Group',
                    toast: {
                      updated: 'Server group updated.',
                    },
                  },
                  deleteServerGroup: {
                    title: 'Confirm Server Group Deletion',
                    content: 'Are you sure you want to delete **{group}** from your account?',
                    toast: {
                      deleted: 'Server group deleted.',
                    },
                  },
                  addServerToGroup: {
                    title: 'Add Server to {group}',
                    noServers: 'All servers are already in this group.',
                    toast: {
                      added: 'Server added to group.',
                    },
                  },
                },
                noGroups: 'No Groups could be found, time to create one?',
              },
            },
            allServers: {
              title: 'All Servers',
              page: {
                input: {
                  showOtherUsersServers: "Show other user's servers",
                },
                modal: {
                  addToServerGroup: {
                    title: 'Add {server} to Server Group',
                    form: {
                      serverGroup: 'Server Group',
                    },
                  },
                },
              },
            },
          },
          bulkActions: {
            selectionMode: 'Selection Mode',
            select: 'Select server',
            deselect: 'Deselect server',
            success: 'Successfully {action} {servers}.',
            partial: 'Successfully {action} {successfulServers}. {failedServers} failed.',
            groupActions: 'Group Actions',
          },
          noServers: 'No Servers could be found, time to add one?',
        },
        admin: {
          title: 'Admin',
        },
        account: {
          title: 'Account',
          alert: {
            requireTwoFactor: {
              title: 'Two-Factor Authentication Required',
              description:
                'Two-Factor Authentication is required on your account. Please set it up below to continue using the panel.',
            },
          },
          containers: {
            password: {
              title: 'Password',
              toast: {
                updated: 'Password updated successfully.',
              },
              form: {
                currentPassword: 'Current Password',
                newPassword: 'New Password',
                confirmNewPassword: 'Confirm New Password',
              },
            },
            email: {
              title: 'Email',
              toast: {
                updated: 'Email updated successfully.',
              },
              form: {
                newEmail: 'New Email',
                currentPassword: 'Current Password',
              },
            },
            twoFactor: {
              title: 'Two-Factor Authentication',
              toast: {
                disabled: 'Two-factor authentication disabled successfully.',
                enabled: 'Two-factor authentication enabled successfully. Please copy your recovery codes.',
              },
              modal: {
                disableTwoFactor: {
                  title: 'Disable Two-Factor Authentication',
                  description: 'Disabling two-factor authentication will make your account less secure.',
                  form: {
                    code: 'Authentication Code',
                  },
                },
                setupTwoFactor: {
                  title: 'Setup Two-Factor Authentication',
                  description:
                    "Help protect your account from unauthorized access. You'll be prompted for a verification code each time you sign in.",
                  descriptionQR:
                    'Scan the QR code above using the two-factor authentication app of your choice. Then, enter the 6-digit code generated into the field below.',
                  form: {
                    code: 'Authentication Code',
                  },
                },
                recoveryCodes: {
                  title: 'Recovery Codes',
                  description:
                    'Below are your recovery codes. Store these in a safe place. If you lose access to your authentication device, you can use these codes to regain access to your account.',
                },
              },
              button: {
                disableTwoFactor: 'Disable Two-Factor',
                setupTwoFactor: 'Setup Two-Factor',
              },
              twoFactorEnabled: 'Two-Factor Verification is currently enabled.',
              twoFactorDisabled:
                'You do not currently have two-factor verification enabled on your account. Click the button below to begin configuring it.',
              twoFactorLastUsed: 'Last used: **{date}**',
            },
            account: {
              title: 'Account Details',
              toast: {
                updated: 'Account details updated successfully.',
              },
              form: {
                nameFirst: 'First Name',
                nameLast: 'Last Name',
                username: 'Username',
                language: 'Language',
                toastPosition: 'Toast Position',
                startOnGroupedServers: 'Start on the Grouped Servers page',
              },
            },
            avatar: {
              title: 'Avatar',
              toast: {
                updated: 'Avatar updated successfully.',
                removed: 'Avatar removed successfully.',
              },
              form: {
                avatar: 'Avatar',
              },
            },
          },
        },
        securityKeys: {
          title: 'Security Keys',
          table: {
            columns: {
              credentialId: 'Credential ID',
            },
          },
          tooltip: {
            secureContextRequired: 'A secure context (HTTPS) is required to use security keys.',
          },
          modal: {
            createSecurityKey: {
              title: 'Create Security Key',
              toast: {
                created: 'Security key created successfully.',
                aborted: 'Security key creation aborted.',
              },
            },
            editSecurityKey: {
              title: 'Edit Security Key',
              toast: {
                updated: 'Security key updated successfully.',
              },
            },
            deleteSecurityKey: {
              title: 'Confirm Security Key Deletion',
              content: 'Are you sure you want to delete **{key}** from your account?',
              toast: {
                deleted: 'Security key deleted successfully.',
              },
            },
          },
        },
        sessions: {
          title: 'Sessions',
          table: {
            columns: {
              ip: 'IP',
              thisDevice: 'This Device?',
              userAgent: 'User Agent',
            },
          },
          modal: {
            deleteSession: {
              title: 'Confirm Session Deletion',
              content: 'Are you sure you want to delete the session **{ip}** from your account?',
              toast: {
                deleted: 'Session deleted.',
              },
            },
          },
        },
        shortcuts: {
          title: 'Keyboard Shortcuts',
          description: 'Use these keyboard shortcuts to navigate and interact with the panel more efficiently.',
          detectedMac: 'macOS detected',
          detectedWindows: 'Windows/Linux detected',
          fileManager: {
            title: 'File Manager',
            selectAll: 'Select all files',
            cutFiles: 'Cut selected files',
            copyFiles: 'Copy selected files',
            duplicateFile: 'Duplicate selected file',
            pasteFiles: 'Paste files',
            searchFiles: 'Search files',
            moveUpDirectory: 'Move Up a directory',
            moveUpSelection: 'Move Up the selection',
            moveDownSelection: 'Move Down the selection',
            renameFile: 'Rename file',
            deselectAll: 'Deselect all files',
            deleteFiles: 'Delete selected files',
          },
          table: {
            title: 'Table Navigation',
            previousPage: 'Previous page',
            nextPage: 'Next page',
            firstPage: 'First page',
            lastPage: 'Last page',
          },
          console: {
            title: 'Server Console',
            searchContent: 'Search in console output',
            previousCommand: 'Previous command in history',
            nextCommand: 'Next command in history',
          },
          serverList: {
            title: 'Server List',
            selectServer: 'Hold S and click to select/deselect server',
          },
        },
        sshKeys: {
          title: 'SSH Keys',
          button: {
            import: 'Import',
          },
          table: {
            columns: {
              fingerprint: 'Fingerprint',
            },
          },
          modal: {
            createSshKey: {
              title: 'Create SSH Key',
              toast: {
                created: 'SSH key created.',
              },
              button: {
                uploadKeyFile: 'Upload Key File',
              },
              form: {
                publicKey: 'Public Key',
              },
            },
            editSshKey: {
              title: 'Edit SSH Key',
              toast: {
                updated: 'SSH Key updated.',
              },
            },
            importSshKeys: {
              title: 'Import SSH Keys',
              toast: {
                created: '{sshKeys} created.',
              },
              form: {
                provider: 'Provider',
                username: 'Username',
              },
            },
            deleteSshKey: {
              title: 'Confirm SSH Key Deletion',
              content: 'Are you sure you want to delete **{name}** from your account?',
              toast: {
                removed: 'SSH key removed.',
              },
            },
          },
        },
        commandSnippets: {
          title: 'Command Snippets',
          table: {
            columns: {
              eggs: 'Eggs',
            },
          },
          form: {
            eggs: 'Eggs',
            command: 'Command',
          },
          modal: {
            createCommandSnippet: {
              title: 'Create Command Snippet',
              toast: {
                created: 'Command snippet created.',
              },
            },
            editCommandSnippet: {
              title: 'Edit Command Snippet',
              toast: {
                updated: 'Command snippet updated.',
              },
            },
            deleteCommandSnippet: {
              title: 'Confirm Command Snippet Deletion',
              content: 'Are you sure you want to delete **{name}** from your account?',
              toast: {
                removed: 'Command snippet removed.',
              },
            },
          },
        },
        oauthLinks: {
          title: 'OAuth Links',
          button: {
            connect: 'Connect',
            connectTo: 'Connect to {provider}',
          },
          table: {
            columns: {
              providerName: 'Provider Name',
              identifier: 'Identifier',
            },
          },
          modal: {
            deleteOAuthLink: {
              title: 'Confirm OAuth Link Deletion',
              content: 'Are you sure you want to delete the **{provider}** connection from your account?',
              toast: {
                removed: 'OAuth Link removed.',
              },
            },
          },
        },
        apiKeys: {
          title: 'API Keys',
          button: {
            apiDocumentation: 'API Documentation',
          },
          table: {
            columns: {
              key: 'Key',
              permissions: 'User / Server / Admin Permissions',
              expires: 'Expires',
            },
          },
          modal: {
            createApiKey: {
              title: 'Create API Key',
              toast: {
                created: 'API key created.',
              },
            },
            updateApiKey: {
              title: 'Update API Key',
              toast: {
                updated: 'API key updated.',
              },
            },
            deleteApiKey: {
              title: 'Confirm API Key Deletion',
              content: 'Are you sure you want to delete **{name}** from your account?',
              toast: {
                removed: 'API key removed.',
              },
            },
          },
          form: {
            allowedIps: 'Allowed IPs',
            allowedIpsPlaceholder: 'e.g. 192.168.1.1, 2001:db8::1',
            userPermissions: 'User Permissions',
            serverPermissions: 'Server Permissions',
            adminPermissions: 'Admin Permissions',
          },
        },
        activity: {
          title: 'Activity',
        },
      },
      admin: {},
      server: {
        viewAdmin: {
          title: 'View admin',
        },
        console: {
          title: 'Console',
          input: {
            placeholder: 'Type a command...',
            ariaLabel: 'Console command input.',
          },
          toast: {
            installCancelled: 'Server install cancelled.',
          },
          modal: {
            sshDetails: {
              title: 'SSH Details',
              form: {
                protocol: 'Protocol',
                port: 'Port',
                host: 'Host',
                username: 'Username',
                password: 'Password',
                yourPassword: 'Your Control Panel Password',
                command: 'SSH Command',
              },
              launch: 'Launch',
            },
          },
          notification: {
            nodeMaintenance: 'Your Server is on a node that is currently under maintenance.',
            transferring: 'Your Server is currently being transferred to another node.',
            restoringBackup: 'Your Server is currently restoring from a backup. Please wait...',
            installing: 'Your Server is currently being installed. Please wait...',
          },
          message: {
            serverMarkedAs: 'Server marked as {state}...',
            installFailed: 'Installation has failed.',
            installCompleted: 'Installation has completed successfully.',
            transferFailed: 'Transfer has failed.',
            pullingImage: "Your Server is currently pulling it's docker image. Please wait...",
            pulling: 'Pulling',
            extracting: 'Extracting',
            layer: 'Layer',
          },
          tooltip: {
            search: 'Search',
            sshDetails: 'SSH Details',
            commandHistory: 'Command History',
            decreaseFontSize: 'Decrease Font Size',
            increaseFontSize: 'Increase Font Size',
          },
          drawer: {
            commandHistory: {
              title: 'Command History',
              detailTitle: 'Command Details',
              noCommands: 'No commands found.',
              copyButton: 'Copy Command',
              sendButton: 'Send Command',
              commandSent: 'Command sent successfully.',
            },
          },
          feature: {
            eula: {
              title: 'Minecraft EULA Agreement',
              content:
                'The Minecraft server requires you to accept the [Minecraft End User License Agreement](https://minecraft.net/eula) before it can start.',
              contentDetails:
                'By clicking "Accept EULA", you agree to the terms of the Minecraft EULA and the **eula.txt** file will be updated to **eula=true**.',
              toast: {
                accepted: 'EULA accepted successfully.',
              },
              button: {
                accept: 'Accept EULA',
              },
            },
          },
          details: {
            address: 'Address',
            port: 'Port',
            uptime: 'Uptime',
            cpuLoad: 'CPU Load',
            memoryLoad: 'Memory Load',
            diskUsage: 'Disk Usage',
            networkIn: 'Network (In)',
            networkOut: 'Network (Out)',
            normalizeCpuLoad: 'Normalize CPU Load (shifted to max 100%)',
          },
          power: {
            start: 'Start',
            stop: 'Stop',
            restart: 'Restart',
            kill: 'Kill',
            modal: {
              forceStop: {
                title: 'Forcibly Stop Process',
                content: 'Forcibly stopping a server can lead to data corruption.',
              },
            },
          },
          stats: {
            cpuLoad: 'CPU Load',
            memoryLoad: 'Memory Load',
            network: 'Network',
            inbound: 'Inbound',
            outbound: 'Outbound',
          },
          socketConnected: 'Connected ({ping}ms ping)',
          socketDisconnected: 'Disconnected',
        },
        files: {
          title: 'Files',
          titleEditorViewing: 'Viewing {file}',
          titleEditorEditing: 'Editing {file}',
          titleEditorNew: 'New File',
          table: {
            columns: {
              modified: 'Modified',
            },
          },
          button: {
            new: 'New',
            sftpDetails: 'SFTP Details',
            openInNewWindow: 'Open in new Window',
            details: 'Details',
            rename: 'Rename',
            copy: 'Copy',
            move: 'Move',
            fingerprint: 'Fingerprint',
            permissions: 'Permissions',
            unarchive: 'Unarchive',
            archive: 'Archive',
            more: 'More',
            remoteCopy: 'Remote Copy',
            search: 'Search',
            exitBackup: 'Exit Backup',
            fileFromEditor: 'File from Editor',
            directory: 'Directory',
            fileFromPull: 'File from Pull',
            fileFromUpload: 'File from Upload',
            directoryFromUpload: 'Directory from Upload',
          },
          actionBar: {
            copyHere: 'Copy {files} here',
            moveHere: 'Move {files} here',
          },
          searchBanner: {
            resultsTitle: 'Search Results ({files} found)',
            query: 'Query:',
            excluded: 'Excluded:',
            content: 'Content:',
            size: 'Size:',
            min: 'Min:',
            max: 'Max:',
          },
          operations: {
            uploadingFolder: 'Uploading folder: {folder} ({current}/{total} files)',
            waiting: 'Waiting: ',
            uploading: 'Uploading: ',
            compressing: 'Compressing {files} from {path}',
            decompressing: 'Decompressing {path}',
            pulling: 'Pulling {destination}',
            copying: 'Copying {path} to {destination}',
            copyingMany: 'Copying {files}',
            receivingRemote: 'Receiving {files} from remote server',
            sendingRemote: 'Sending {files} to remote server',
          },
          dropzone: {
            title: 'Drop files here to upload',
            subtitle: 'Release to start uploading',
          },
          settings: {
            clickOnce: 'Click once to open file or folder',
            preferPhysicalSize: 'Show physical size instead of logical size',
            editorMinimap: 'Show File Minimap',
            editorLineOverflow: 'Wrap Line Overflow',
            imageViewerSmoothing: 'Smoothen Image (Anti-Aliasing)',
          },
          toast: {
            operationCancelled: 'Operation cancelled',
            copyingStarted: '{files} started copying.',
            filesCouldNotBeMoved: 'Files could not be moved.',
            filesMoved: '{files} moved.',
            downloadStarted: 'Download started.',
            filesDeleted: 'Files have been deleted.',
            archiveCreationStarted: 'Archive creation has begun.',
            fileCopyingStarted: 'File copying has started.',
            fileInfoRetrieved: 'File information retrieved successfully.',
            filePullingStarted: 'File pulling has started.',
            fileRenamed: 'File has been renamed.',
            fileCouldNotBeRenamed: 'File could not be renamed.',
            permissionsUpdated: 'Permissions have been updated.',
            fileSaved: 'File has been saved.',
          },
          modal: {
            activeUploads: {
              title: 'Active Uploads',
              content:
                'Are you sure you want to leave this page? You have {files} active file uploads. If you leave this page, the file uploads will abort.',
              button: {
                leave: 'Leave Page',
              },
            },
            unsavedChanges: {
              title: 'Unsaved Changes',
              content:
                'You have unsaved changes in the file editor. Are you sure you want to leave this page? If you leave, your changes will be lost.',
              button: {
                leave: 'Leave Page',
              },
            },
            createArchive: {
              title: 'Create Archive',
              form: {
                archiveName: 'Archive Name',
                format: 'Format',
              },
              createdAs: 'This archive will be created as ',
            },
            createDirectory: {
              title: 'Create Directory',
              form: {
                directoryName: 'Directory Name',
              },
              createdAs: 'This directory will be created as ',
            },
            copyFile: {
              title: 'Copy File',
              form: {
                fileName: 'File Name',
              },
              createdAs: 'This file will be created as ',
            },
            copyRemote: {
              title: 'Remote Copy Files',
              form: {
                server: 'Server',
                destination: 'Destination',
              },
              createdAs: 'These files will be created on the remote server under ',
            },
            fileFingerprints: {
              title: 'File Fingerprint',
              form: {
                algorithm: 'Algorithm',
                fingerprint: 'Fingerprint',
              },
              button: {
                calculate: 'Calculate Fingerprint',
              },
            },
            deleteFile: {
              title: 'Delete File',
              singleFileWarning: 'You will not be able to recover the contents of {file} once deleted.',
              multipleFilesWarning: 'You will not be able to recover the contents of the following files once deleted.',
            },
            createFile: {
              title: 'Create File',
              form: {
                fileName: 'File Name',
              },
            },
            details: {
              title: 'File Details',
              path: 'Path',
              mode: 'Mode',
              logicalSize: 'Logical Size',
              physicalSize: 'Physical Size',
              mimeType: 'MIME Type',
              lastModifiedAt: 'Last Modified At',
              createdAt: 'Created At',
            },
            filePermissions: {
              title: 'File Permissions',
              symbolic: 'Symbolic:',
              octal: 'Octal:',
              owner: 'Owner',
              group: 'Group',
              other: 'Other',
              breakdown: 'Permission Breakdown',
              readPermission: 'Read permission (4)',
              writePermission: 'Write permission (2)',
              executePermission: 'Execute permission (1)',
            },
            renameFile: {
              title: 'Rename File',
              form: {
                fileName: 'File Name',
              },
            },
            searchFiles: {
              title: 'Search Files',
              placeholder: 'Search for files...',
              advancedFilters: 'Advanced Filters',
              pathPatterns: 'Path Patterns',
              include: 'Include',
              exclude: 'Exclude',
              caseInsensitive: 'Case insensitive',
              fileContent: 'File Content',
              searchText: 'Search text',
              maxFileSize: 'Max file size',
              includeOversized: 'Include oversized files',
              includeOversizedDescription: 'Include files that match other filters but are too large to search',
              fileSize: 'File Size',
              minimum: 'Minimum',
              maximum: 'Maximum',
            },
            pullFile: {
              title: 'Pull File',
              form: {
                fileUrl: 'File URL',
                query: 'Query',
                fileName: 'File Name',
              },
              createdAs: 'This file will be created as ',
              pull: 'Pull',
            },
            sftpDetails: {
              title: 'SFTP Details',
              form: {
                protocol: 'Protocol',
                port: 'Port',
                host: 'Host',
                username: 'Username',
                password: 'Password',
                yourPassword: 'Your Control Panel Password',
              },
              launch: 'Launch',
            },
          },
        },
        databases: {
          title: 'Databases',
          subtitle: '{current} of {max} maximum databases created.',
          tooltip: {
            limitReached: 'This server is limited to {max} databases.',
          },
          table: {
            columns: {
              type: 'Type',
              address: 'Address',
              locked: 'Locked?',
            },
          },
          button: {
            details: 'Details',
            rotatePassword: 'Rotate Password',
          },
          modal: {
            createDatabase: {
              title: 'Create Database',
              toast: {
                created: 'Database created.',
              },
              form: {
                databaseName: 'Database Name',
                databaseHost: 'Database Host',
                noHostsFound: 'No hosts found',
              },
            },
            editDatabase: {
              title: 'Edit Database',
              toast: {
                updated: 'Database updated.',
              },
              form: {
                locked: 'Locked',
              },
            },
            databaseDetails: {
              title: 'Database connection details',
              toast: {
                passwordRotated: 'Password has been rotated.',
              },
              form: {
                jdbcConnectionString: 'JDBC Connection String',
              },
            },
            deleteDatabase: {
              title: 'Confirm Database Deletion',
              content:
                'Deleting a database is a permanent action, it cannot be undone. This will permanently delete the **{name}** database and remove all associated data.',
              toast: {
                deleted: 'Database deleted.',
              },
            },
          },
        },
        schedules: {
          title: 'Schedules',
          dropzone: {
            title: 'Drop some files here to import them as Schedules',
            subtitle: 'Release to start importing',
          },
        },
        subusers: {
          title: 'Subusers',
          table: {
            columns: {
              twoFactorEnabled: '2FA Enabled',
              permissions: 'Permissions',
              ignoredFiles: 'Ignored Files',
            },
          },
          modal: {
            createSubuser: {
              title: 'Create Subuser',
              toast: {
                created: 'Subuser created.',
              },
              form: {
                email: 'Email',
                emailPlaceholder: 'Enter the email that this subuser should be saved as.',
                permissions: 'Permissions',
                ignoredFiles: 'Ignored Files',
              },
            },
            updateSubuser: {
              title: 'Update Subuser',
              toast: {
                updated: 'Subuser updated.',
              },
            },
            removeSubuser: {
              title: 'Confirm Subuser Removal',
              content: 'Are you sure you want to remove **{username}** from this server?',
              toast: {
                removed: 'Subuser removed.',
              },
            },
          },
        },
        backups: {
          title: 'Backups',
          subtitle: '{current} of {max} maximum backups created.',
          tooltip: {
            limitReached: 'This server is limited to {max} backups.',
          },
          table: {
            columns: {
              checksum: 'Checksum',
              files: 'Files',
              locked: 'Locked?',
            },
          },
          button: {
            browse: 'Browse',
          },
          toast: {
            downloadStarted: 'Download started.',
            restoringBackup: 'Restoring backup...',
          },
          modal: {
            createBackup: {
              title: 'Create Backup',
              toast: {
                created: 'Backup created.',
              },
              form: {
                ignoredFiles: 'Ignored Files',
              },
            },
            editBackup: {
              title: 'Edit Backup',
              toast: {
                updated: 'Backup updated.',
              },
              form: {
                locked: 'Locked',
              },
            },
            restoreBackup: {
              title: 'Restore Backup',
            },
            deleteBackup: {
              title: 'Confirm Backup Deletion',
              content: 'Are you sure you want to delete **{name}** from this server?',
              toast: {
                deleted: 'Backup deleted.',
              },
            },
          },
        },
        network: {
          title: 'Network',
          subtitle: '{current} of {max} maximum allocations assigned.',
          tooltip: {
            limitReached: 'This server is limited to {max} allocations.',
            primary: 'Primary',
          },
          table: {
            columns: {
              hostname: 'Hostname',
              port: 'Port',
              notes: 'Notes',
            },
          },
          button: {
            setPrimary: 'Set Primary',
            unsetPrimary: 'Unset Primary',
          },
          toast: {
            created: 'Allocation created.',
            updated: 'Allocation updated.',
            removed: 'Allocation removed.',
            setPrimary: 'Allocation set as primary.',
            unsetPrimary: 'Allocation unset as primary.',
          },
          modal: {
            editAllocation: {
              title: 'Edit Allocation',
              form: {
                notes: 'Notes',
              },
            },
            removeAllocation: {
              title: 'Confirm Allocation Removal',
              content: 'Are you sure you want to remove **{allocation}** from this server?',
            },
          },
        },
        startup: {
          title: 'Startup',
          form: {
            startupCommand: 'Startup Command',
            dockerImage: 'Docker Image',
          },
          variables: 'Variables',
          dockerImageDescription:
            'The Docker image used to run this server. This can be changed to use a different image.',
          dockerImageDescriptionCustom:
            'The Docker image used to run this server. This has been set by an administrator and cannot be changed.',
          toast: {
            startupCommandUpdated: 'Startup command updated.',
            dockerImageUpdated: 'Docker image updated.',
            variablesUpdated: 'Variables updated.',
          },
        },
        mounts: {
          title: 'Mounts',
          table: {
            columns: {
              target: 'Target',
              mounted: 'Mounted',
              readOnly: 'Read Only',
            },
          },
          modal: {
            attachMount: {
              title: 'Attach Mount',
              content: 'Do you want to attach **{name}** to `{target}`?',
              confirm: 'Attach',
              toast: {
                attached: '{name} has been mounted to your server.',
              },
            },
            detachMount: {
              title: 'Detach Mount',
              content: 'Do you want to detach **{name}** from `{target}`?',
              confirm: 'Detach',
              toast: {
                detached: '{name} has been removed from your server.',
              },
            },
          },
        },
        settings: {
          title: 'Settings',
          debugInformation: {
            title: 'Debug Information',
            form: {
              nodeName: 'Node (UUID)',
              locationName: 'Location (UUID)',
              serverUuid: 'Server UUID',
            },
          },
          rename: {
            title: 'Rename Server',
            form: {
              serverName: 'Server Name',
            },
            toast: {
              renamed: 'Server renamed.',
            },
          },
          timezone: {
            title: 'Timezone',
            form: {
              timezone: 'Timezone',
              system: 'System',
            },
            toast: {
              updated: 'Server timezone updated.',
            },
          },
          autokill: {
            title: 'Auto-Kill',
            form: {
              enabled: 'Enabled',
              secondsUntilAutoKill: 'Seconds until auto-kill',
            },
            toast: {
              updated: 'Server auto-kill updated.',
            },
          },
          autostart: {
            title: 'Auto-Start',
            form: {
              behavior: 'Behavior',
            },
            toast: {
              updated: 'Server auto-start behavior updated.',
            },
          },
          reinstall: {
            title: 'Reinstall Server',
            button: 'Reinstall Server',
            content:
              'Reinstalling your server will stop it, and then re-run the installation script that initially set it up. **Some files may be deleted or modified during this process, please back up your data before continuing.**',
            modal: {
              title: 'Reinstall Server',
              button: 'Reinstall',
              toast: {
                reinstalling: 'Reinstalling server...',
              },
            },
          },
        },
        activity: {
          title: 'Activity',
        },
      },
    },
  },
});

for (const [path, translations] of Object.entries(extensionTranslations ?? {})) {
  const identifier = path.split('/')[2];
  if (identifier === 'shared') continue;

  if (
    typeof translations === 'object' &&
    translations &&
    'default' in translations &&
    translations.default instanceof DefinedTranslations
  ) {
    translations.default.namespace = identifier.replaceAll('_', '.');
    baseTranslations.mergeFrom(translations.default);
  } else {
    console.error('Invalid frontend translations', identifier, translations);
  }
}

if (import.meta.env?.DEV) {
  console.debug('Initialized base translations', baseTranslations);
}

export default baseTranslations;
