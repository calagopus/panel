import { DefinedTranslations, defineEnglishItem, defineTranslations } from 'shared';

let extensionTranslations: Record<string, unknown> = {};
try {
  extensionTranslations = import.meta.glob('../extensions/*/src/translations.ts', { eager: true });
} catch {
  // Ignore
}

const baseTranslations = defineTranslations({
  items: {
    byte: defineEnglishItem('Byte', 'Bytes'),
    user: defineEnglishItem('User', 'Users'),
    file: defineEnglishItem('File', 'Files'),
    server: defineEnglishItem('Server', 'Servers'),
    sshKey: defineEnglishItem('SSH Key', 'SSH Keys'),
    asset: defineEnglishItem('Asset', 'Assets'),
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
        discard: 'Discard',
        download: 'Download',
        downloadAs: 'Download as {format}',
        export: 'Export',
        exportAs: 'Export as {format}',
        recreate: 'Recreate',
      },
      alert: {
        error: 'Error',
        warning: 'Warning',
        success: 'Success',
        clockOffset:
          'Your system clock is out of sync with the server by more than 5 seconds. This may cause issues with passkey authentication and two-factor authentication. Please sync your clock if issues arise. Current offset: {offset} second(s).',
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
        url: 'URL',
        email: 'Email',
        path: 'Path',
        port: 'Port',
        provider: 'Provider',
        command: 'Command',
        fromAddress: 'From Address',
        fromName: 'From Name',
        siteKey: 'Site Key',
        secretKey: 'Secret Key',
        apiKey: 'API Key',
        accessKey: 'Access Key',
        bucket: 'Bucket',
        region: 'Region',
        endpoint: 'Endpoint',
        publicUrl: 'Public URL',
        firstName: 'First Name',
        lastName: 'Last Name',
        language: 'Language',
        identifier: 'Identifier',
        enabled: 'Enabled',
        truncateDirectory:
          'Do you want to delete all files of this server before performing this action? This cannot be undone.',
      },
      table: {
        pagination: {
          results: 'Showing {start} to {end} of {total} results.',
          empty: "No items could be found, it's almost like they are hiding.",
        },
        columns: {
          id: 'ID',
          name: 'Name',
          type: 'Type',
          title: 'Title',
          enabled: 'Enabled',
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
          location: 'Location',
        },
      },
      tabs: {
        general: 'General',
      },
      badge: {
        active: 'Active',
        inactive: 'Inactive',
        enabled: 'Enabled',
        disabled: 'Disabled',
        successful: 'Successful',
        failed: 'Failed',
        installed: 'Installed',
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
        serverPowerAction: {
          start: 'Start',
          stop: 'Stop',
          restart: 'Restart',
          kill: 'Kill',
        },
        serverBackupStatus: {
          starting: 'Starting',
          finished: 'Finished',
          failed: 'Failed',
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
      unit: {
        bytes: {
          bytes: 'B',
          kibibytes: 'KiB',
          mebibytes: 'MiB',
          gibibytes: 'GiB',
          tebibytes: 'TiB',
          pebibytes: 'PiB',
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
      default: 'Default',
      custom: 'Custom',
      system: 'System',
      schedule: 'Schedule',
      impersonatedBy: 'Impersonated by {username}',
    },
    elements: {
      errorBoundary: {
        message:
          'An unexpected error occurred while rendering this page. Try refreshing. If the problem persists, contact your system administrator.',
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
      pasteOnClick: {
        toast: {
          pasted: 'Pasted from clipboard.',
          failed: 'Failed to paste from clipboard.',
          pasteManual: 'Paste from clipboard: Ctrl+V or Command+V, Enter',
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
          openInVirtualWindow: 'Open in Virtual Window',
          openInPopup: 'Open in Popup',
          openInNewTab: 'Open in New Tab',
          switchToDark: 'Switch to Dark Mode',
          switchToLight: 'Switch to Light Mode',
        },
      },
      permissionSelector: {
        button: {
          copyPermissions: 'Copy Permissions',
          pastePermissions: 'Paste Permissions',
        },
        selectedPermissions: 'Selected Permissions ({count})',
        noPermissions: 'No permissions selected.',
      },
      selectInput: {
        noResults: 'No Results found.',
      },
      can: {
        tooltip: {
          cantSave: 'You do not have permission to save.',
          cantDelete: 'You do not have permission to delete.',
        },
      },
      resource: {
        tooltip: {
          created: '{resource} created.',
          updated: '{resource} updated.',
          deleted: '{resource} deleted.',
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
      scheduleDynamicInput: {
        enterVariable: 'Please enter the variable name to evaluate.',
        enterData: 'Please enter the data to send.',
        inputType: 'Input Type',
        dataType: 'Data type to send',
        selectType: 'Select Type',
        none: 'None',
        rawString: 'Raw String',
        variable: 'Variable',
      },
      serverWebsocket: {
        error: {
          connectionFailed: 'Unable to connect after multiple attempts. Please refresh the page.',
          connectionClosed: 'Connection to server was closed. Attempting to reconnect...',
          connectionRetry: 'Connection lost. Retrying (attempt {attempt})...',
          authFailed: 'Authentication failed. Attempting to refresh credentials... ({error})',
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
                completedFrom: 'Copied {files} from remote server in {time}.',
                completedTo: 'Copied {files} to remote server in {time}.',
                failedFrom: 'Failed to copy {files} from remote server:\n{error}',
                failedTo: 'Failed to copy {files} to remote server:\n{error}',
              },
            },
          },
        },
      },
      fileUpload: {
        toast: {
          uploading: 'Started uploading {files}...',
          cancelledFile: 'Successfully cancelled upload of `{file}`.',
          cancelledFolder: 'Successfully cancelled upload of `{folder}` ({files}).',
          cancelledAll: 'All uploads have been cancelled.',
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
            locationFlag: 'Location Flag',
            locationFlagPlaceholder: 'The best country',
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
          allocationsTitle: 'Allocations Configuration',
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
            ip: 'IP',
            portRanges: 'Port Ranges',
            portRangesPlaceholder: 'Port Ranges (eg. 3000-4000)',
          },
          error: {
            noLocations: 'Something went wrong. No locations were found.',
          },
          button: {
            create: 'Create & Continue',
          },
        },
        nodeConfiguration: {
          title: 'Node Configuration',
          error: {
            noNodes: 'Something went wrong. No nodes were found.',
            connectionError: 'Something went wrong. Connection Error.',
          },
          successMessage: 'The connection to your node was successfully verified. You may now continue.',
          configurationDescription: 'Place this into the configuration file at `{file}` or run:',
          button: {
            verify: 'Verify Connection',
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
            registration: 'Enable Registration',
            registrationDescription: 'Allow new users to register their own account.',
          },
          button: {
            submit: 'Update Settings & Continue',
          },
        },
        eggRepositories: {
          title: 'Egg Repositories',
          description: 'These are the source repositories of your eggs. You may change these repositories at any time.',
          repositories: {
            pterodactylGame: {
              title: 'Pterodactyl Game Eggs',
              description: 'Eggs for games like Minecraft, Terraria, and a lot more.',
            },
            pterodactylApplication: {
              title: 'Pterodactyl Application Eggs',
              description: 'Eggs for applications like Grafana, Meilisearch, and various databases.',
            },
            pterodactylGeneral: {
              title: 'Pterodactyl Generic Eggs',
              description: 'Eggs for generic application runtimes like Node JS, Java, and Rust.',
            },
          },
          button: {
            submit: 'Import',
          },
        },
        server: {
          title: 'Server',
          existingServer: 'A server has already been created. You can change the settings later in the admin menu.',
          egg: {
            title: 'Egg',
            description: "Let's get your first server up and running. What egg would you like to use?",
            nestDescription:
              'To start using this egg, you will need to create a nest, nests are collections of eggs. Give it a name:',
          },
          server: {
            title: 'Server',
            nestDescription:
              'To start using this egg, you will need to create a nest, nests are collections of eggs. Give it a name:',
          },
          error: {
            noNodes: 'Something went wrong. No nodes were found.',
          },
          button: {
            submit: 'Import',
            create: 'Create & Continue',
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
            eggRepositories: {
              title: 'Egg Repositories',
              subtitle: '{count} repositories',
            },
            location: 'Location',
            node: 'Node',
            server: 'Server',
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
        alert: {
          urlMismatch:
            'The application URL does not match the current URL. Expected: `{appUrl}`, Current: `{currentUrl}`.',
        },
        login: {
          error: {
            usernameRequired: 'Please enter a username',
            registrationDisabled: 'No matching Account could be found and registration is currently disabled.',
            userAlreadyExists: 'An account with this username or email already exists.',
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
              twoFactorLastUsed: 'Last used: {timestamp}',
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
          subtitle: '{current} of {max} maximum security keys created.',
          table: {
            columns: {
              credentialId: 'Credential ID',
            },
          },
          tooltip: {
            secureContextRequired: 'A secure context (HTTPS) is required to use security keys.',
            limitReached: 'You are limited to {max} security keys.',
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
          subtitle: 'Use these keyboard shortcuts to navigate and interact with the panel more efficiently.',
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
          subtitle: '{current} of {max} maximum ssh keys created.',
          button: {
            import: 'Import',
          },
          tooltip: {
            limitReached: 'You are limited to {max} ssh keys.',
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
          subtitle: '{current} of {max} maximum command snippets created.',
          tooltip: {
            limitReached: 'You are limited to {max} command snippets.',
          },
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
          subtitle: '{current} of {max} maximum api keys created.',
          button: {
            apiDocumentation: 'API Documentation',
          },
          tooltip: {
            limitReached: 'You are limited to {max} api keys.',
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
            recreateApiKey: {
              title: 'Recreate API Key',
              content:
                'Recreating an API key will generate a new key and invalidate the old one. Are you sure you want to recreate the API key **{name}**?',
              toast: {
                recreated: 'API key recreated.',
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
      admin: {
        home: {
          title: 'Home',
          alert: {
            newPanelVersion:
              'A new version is available for the panel! You are currently on {current} and the latest version is {latest}. You may want to consider upgrading. [Click here]({upgradeUrl}) to view upgrade instructions.',
          },
          tabs: {
            overview: {
              title: 'Overview',
              page: {
                permissionDenied:
                  'You do not have permission to read the statistics that would have been here otherwise. For now, enjoy this bird',
                card: {
                  systemOverview: 'System Overview',
                  generalStatistics: 'General Statistics',
                  backupStatistics: 'Backup Statistics',
                },
                system: {
                  cpu: 'CPU',
                  memoryUsage: 'Memory Usage ({process} used by Panel)',
                  memoryValue: '{used} / {total} ({percent}%)',
                  kernelVersion: 'Kernel Version ({architecture})',
                  containerType: 'Container Type',
                  databaseVersion: 'Database Version ({size})',
                  cacheVersion: 'Cache Version',
                  cacheCalls: 'Cache Calls',
                  cacheHits: 'Cache Hits ({percent}%)',
                  cacheMisses: 'Cache Misses ({percent}%)',
                  avgCachedCallLatency: 'Avg. Cached Call Latency',
                },
                containerType: {
                  unknown: 'Unknown',
                  none: 'None detected',
                  official: 'Official',
                  officialAio: 'Official AIO',
                  officialHeavy: 'Official Heavy',
                },
                stats: {
                  users: 'Users',
                  servers: 'Servers',
                  locations: 'Locations',
                  nodes: 'Nodes',
                  nestEggs: 'Nest Eggs',
                  databaseHosts: 'Database Hosts',
                  backupConfigurations: 'Backup Configurations',
                  roles: 'Roles',
                },
                backup: {
                  allTime: 'All Time',
                  today: 'Today',
                  week: 'This Week',
                  month: 'This Month',
                  totalAllTime: 'Total backups all time',
                  successfulAllTime: 'Successful backups all time',
                  failedAllTime: 'Failed backups all time',
                  deletedAllTime: 'Deleted backups all time',
                  totalToday: 'Total backups today',
                  successfulToday: 'Successful backups today',
                  failedToday: 'Failed backups today',
                  deletedToday: 'Deleted backups today',
                  totalWeek: 'Total backups this week',
                  successfulWeek: 'Successful backups this week',
                  failedWeek: 'Failed backups this week',
                  deletedWeek: 'Deleted backups this week',
                  totalMonth: 'Total backups this month',
                  successfulMonth: 'Successful backups this month',
                  failedMonth: 'Failed backups this month',
                  deletedMonth: 'Deleted backups this month',
                  successfulValue: '{count} ({size})',
                  deletedValue: '{count} ({size})',
                },
              },
            },
            updates: {
              title: 'Updates',
              page: {
                alert: {
                  extensionUpdateErrors: 'There were errors checking for updates for some extensions.',
                },
                card: {
                  panelVersion: 'Panel Version',
                  versionHistory: 'Version History',
                  outdatedExtensions: 'Outdated Extensions',
                  outdatedNodes: 'Outdated Nodes',
                },
                panelVersion:
                  'Your panel is currently running version `{current}`. The latest available version is `{latest}`.',
                unknown: 'unknown',
                button: { recheck: 'Recheck for Updates' },
                toast: { recheckComplete: 'Recheck complete.' },
                selectHistory: 'Select an update history to view',
                historyPanel: 'Panel',
                historyExtension: 'Extension: {name}',
                extensionsUpToDate: 'All extensions are up to date.',
                extensionsOutdated: 'Some extensions are outdated or had errors when checking for updates.',
                noChangelog: 'No changelog',
                nodesUpToDate: 'Seems like all nodes are up to date. ({failed} failed to check)',
                nodesOutdated:
                  'Some nodes are outdated, the latest available version is `{latest}`. ({outdated} outdated, {failed} failed to check)',
                table: {
                  version: 'Version',
                  installed: 'Installed',
                  packageName: 'Package Name',
                  latestVersion: 'Latest Version',
                  changes: 'Changes',
                  error: 'Error',
                },
              },
            },
            health: {
              title: 'Health',
              page: {
                card: {
                  generalHealth: 'General Health',
                  extensionMigrationHealth: 'Extension Migration Health',
                  desyncNodes: 'Desync Nodes',
                  debugMode: 'Debug Mode',
                },
                appliedMigrations: 'Applied Migrations ({percent}%)',
                migrationsValue: '{applied} / {total}',
                avgNtpOffset: 'Avg. NTP Offset',
                noExtensions: 'No extensions found.',
                nodesSynced:
                  'Seems like all nodes have a synced clock (within 5 seconds of panel clock). ({failed} failed to check)',
                nodesDesync:
                  "Some nodes have desync clocks (over 5 seconds off of the panel's clock). This can cause file download/console issues. ({desync} desync, {failed} failed to check)",
                debugEnabled: 'Debug mode is currently enabled.',
                debugDisabled: 'Debug mode is currently disabled.',
                debugResetNote: 'This setting will be reset to the default ({default}) when the application restarts.',

                table: {
                  packageName: 'Package Name',
                  applied: 'Applied',
                  total: 'Total',
                  id: 'ID',
                  desync: 'Desync',
                  appliedValue: '{applied} ({percent}%)',
                },
                button: {
                  enableDebug: 'Enable Debug Mode',
                  disableDebug: 'Disable Debug Mode',
                },
                toast: {
                  debugEnabled: 'Debug mode enabled.',
                  debugDisabled: 'Debug mode disabled.',
                },
              },
            },
          },
        },
        settings: {
          title: 'Settings',
          tabs: {
            application: {
              title: 'Application',
              page: {
                title: 'Application Settings',
                form: {
                  language: 'Language',
                  icon: 'Icon',
                  banner: 'Banner',
                  sessionCookie: 'Session Cookie',
                  sessionDurationSeconds: 'Session Duration (seconds)',
                  twoFactorRequirement: 'Two-Factor Authentication Requirement',
                  telemetryEnabled: 'Enable Telemetry',
                  telemetryEnabledDescription:
                    'Allow Calagopus to collect limited and anonymous usage data to help improve the application.',
                  registrationEnabled: 'Enable Registration',
                },
                enum: {
                  twoFactorRequirement: {
                    admins: 'Admins',
                    allUsers: 'All Users',
                    none: 'None',
                  },
                },
                button: {
                  previewTelemetry: 'Preview Telemetry',
                },
                toast: {
                  updated: 'Application settings updated.',
                },
                modal: {
                  disableTelemetry: {
                    title: 'Confirm Disabling Telemetry',
                    content:
                      'Are you sure you want to disable telemetry? Telemetry helps us improve Calagopus by providing anonymous usage data. Disabling telemetry will prevent any data from being sent.',
                    button: { confirm: 'Disable' },
                  },
                  enableRegistration: {
                    title: 'Confirm Enabling Registration',
                    content:
                      'Are you sure you want to enable registration? Enabling registration allows anyone to create an account on this panel. If you do not have a captcha configured, this may be a mistake.',
                    button: { confirm: 'Enable' },
                  },
                  telemetryPreview: {
                    title: 'Telemetry Preview',
                  },
                },
              },
            },
            storage: {
              title: 'Storage',
              page: {
                title: 'Storage Settings',
                form: {
                  driver: 'Driver',
                },
                enum: {
                  driver: {
                    filesystem: 'Filesystem',
                    s3: 'S3',
                  },
                },
                toast: {
                  updated: 'Storage settings updated.',
                },
                modal: {
                  changeStorageType: {
                    title: 'Confirm Changing Storage Type',
                    content:
                      'Are you sure you want to change the storage type? Changing the storage type will cause the application to look for assets (e.g. profile pictures) in a different location, which may result in missing assets if they are not moved to the new location manually.',
                    button: { confirm: 'Update' },
                  },
                },
                s3: {
                  alert: {
                    permissionsTitle: 'Note on Permissions',
                    permissionsIntro:
                      'To ensure that the storage backend works correctly, please make sure the following subdirectories are publicly accessible over the "Public URL" you provided:',
                    permissionsAssets: 'This is where all admin assets (e.g., icons) will be stored.',
                    permissionsAvatars: 'This is where all user avatars will be stored.',
                    permissionsPublicData: 'This is where extensions can store public data (e.g., images).',
                  },
                  form: {
                    pathStyleOn: 'Using path-style URLs',
                    pathStyleOff: 'Using virtual-hosted-style URLs',
                  },
                },
              },
            },
            mail: {
              title: 'Mail',
              page: {
                title: 'Email Settings',
                enum: {
                  provider: {
                    none: 'None',
                    smtp: 'SMTP',
                    sendmail: 'Sendmail Command',
                    filesystem: 'Filesystem',
                  },
                },
                button: {
                  sendTestEmail: 'Send Test Email',
                },
                toast: {
                  updated: 'Email settings updated.',
                },
                modal: {
                  sendTestEmail: {
                    title: 'Send Test Email',
                    button: {
                      submit: 'Send Test Email',
                    },
                    toast: {
                      sent: 'Test email has been sent successfully.',
                    },
                  },
                },
                smtp: {
                  form: {
                    useTls: 'Use TLS',
                    skipCertValidation: 'Skip Certificate Validation',
                  },
                },
              },
            },
            mailTemplates: {
              title: 'Mail Templates',
              page: {
                title: 'Email Template Settings',
                sidebar: {
                  templates: 'Templates',
                  loading: 'Loading...',
                  availableVariables: 'Available Variables',
                },
                alert: {
                  syntaxBefore: 'Templates use the',
                  syntaxLink: 'MiniJinja',
                  syntaxMiddle: 'templating syntax. Variables are referenced with',
                  syntaxAnd: 'and control structures like',
                  syntaxOr: 'and',
                  syntaxAfter: 'are supported.',
                },
                empty: 'Select a template from the sidebar to edit it',
                loadingTemplate: 'Loading template...',
                form: {
                  subject: 'Subject',
                },
                button: {
                  resetToDefault: 'Reset to default',
                },
                toast: {
                  saved: 'Email template saved.',
                  reset: 'Email template reset to default.',
                },
                modal: {
                  reset: {
                    title: 'Reset to default',
                    content:
                      'This will discard your custom template for **{identifier}** and restore the built-in default. This cannot be undone.',
                    button: { confirm: 'Reset' },
                  },
                },
              },
            },
            captcha: {
              title: 'Captcha',
              page: {
                title: 'Captcha Settings',
                toast: {
                  updated: 'Captcha settings updated.',
                },
                recaptcha: {
                  form: {
                    v3: 'V3',
                  },
                },
              },
            },
            webauthn: {
              title: 'Webauthn',
              page: {
                title: 'Webauthn Settings',
                form: {
                  rpId: 'RP Id',
                  rpOrigin: 'RP Origin',
                },
                button: {
                  autofill: 'Autofill',
                },
                toast: {
                  updated: 'Webauthn settings updated.',
                  ipNotAllowed: 'Cannot use WebAuthn on an IP address.',
                },
                modal: {
                  changeRpId: {
                    title: 'Confirm Changing RP Id',
                    content:
                      'Are you sure you want to change the RP Id? Changing the RP Id will break all existing Webauthn credentials and require users to re-register their devices. This can have significant consequences, so please make sure you understand the implications before proceeding.',
                    button: { confirm: 'Update' },
                  },
                },
              },
            },
            server: {
              title: 'Server',
              page: {
                title: 'Server Settings',
                form: {
                  maxFileManagerViewSize: 'Max File Manager View Size',
                  maxScheduleStepCount: 'Max Schedule Steps',
                  maxFileManagerContentSearchSize: 'Max File Manager Content Search Size',
                  maxFileManagerSearchResults: 'Max File Manager Search Results',
                  maxSubuserCount: 'Max Subuser Count',
                  allowOverwritingCustomDockerImage: 'Allow Overwriting Custom Docker Image',
                  allowOverwritingCustomDockerImageDescription:
                    'If enabled, users will be able to overwrite the Docker image specified in the server configuration using the Eggs list, even if an admin has set a custom Docker image.',
                  allowViewingInstallationLogs: 'Allow Viewing Installation Logs',
                  allowViewingInstallationLogsDescription:
                    'If enabled, users with console read permissions will also be able to view installation logs via the websocket connection. If disabled, installation logs will only be available for admins.',
                  allowAcknowledgingInstallationFailure: 'Allow Acknowledging Installation Failure',
                  allowAcknowledgingInstallationFailureDescription:
                    'If enabled, users will be able to acknowledge installation failures for servers that are in the "Install Failed" state, allowing them to attempt to start the server instead of having to wait for an admin. If disabled, only admins will be able to acknowledge installation failures.',
                  allowViewingTransferProgress: 'Allow Viewing Transfer Progress',
                  allowViewingTransferProgressDescription:
                    'If enabled, users with console read permissions will also be able to view transfer progress logs via the websocket connection. If disabled, transfer progress logs will only be available for admins.',
                },
                toast: {
                  updated: 'Server settings updated.',
                },
              },
            },
            user: {
              title: 'User',
              page: {
                title: 'User Settings',
                form: {
                  maxServerGroupCount: 'Max Server Groups',
                  maxApiKeyCount: 'Max API Keys',
                  maxCommandSnippetCount: 'Max Command Snippets',
                  maxSecurityKeyCount: 'Max Security Keys',
                  maxSshKeyCount: 'Max SSH Keys',
                  allowChangingLanguage: 'Allow Changing Language',
                  allowChangingLanguageDescription:
                    'If enabled, users will be able to change their language preferences.',
                },
                toast: {
                  updated: 'User settings updated.',
                },
              },
            },
            activity: {
              title: 'Activity',
              page: {
                title: 'Activity Settings',
                form: {
                  adminLogRetentionDays: 'Admin Activity Retention Days',
                  userLogRetentionDays: 'User Activity Retention Days',
                  serverLogRetentionDays: 'Server Activity Retention Days',
                  adminLogRetentionCount: 'Admin Activity Retention Count',
                  userLogRetentionCount: 'User Activity Retention Count',
                  serverLogRetentionCount: 'Server Activity Retention Count',
                  serverLogAdminActivity: 'Log Server Admin Activity',
                  serverLogAdminActivityDescription:
                    "Enable or disable logging of admin activity on servers where the admin isn't an owner or subuser.",
                  serverLogScheduleActivity: 'Log Server Schedule Activity',
                  serverLogScheduleActivityDescription:
                    'Enable or disable logging of activity done by server schedules.',
                },
                toast: {
                  updated: 'Activity settings updated.',
                },
              },
            },
            ratelimits: {
              title: 'Ratelimits',
              page: {
                title: 'Ratelimit Settings',
                form: {
                  hits: 'Hits',
                  hitsDescription: 'Max requests',
                  windowSeconds: 'Window',
                  windowSecondsDescription: 'Seconds',
                },
                toast: {
                  updated: 'Rate limit settings updated.',
                },
              },
            },
          },
        },
        announcements: {
          title: 'Announcements',
          resourceName: 'Announcement',
          modal: {
            delete: {
              title: 'Confirm Announcement Deletion',
              content: 'Are you sure you want to delete **{title}**?',
            },
          },
          form: {
            type: 'Type',
            title: 'Title',
            content: 'Content',
            dismissibleEnd: 'Dismissible End',
            enabledStart: 'Enabled Start',
            enabledEnd: 'Enabled End',
            locations: 'Locations',
            locationsDescription: 'Leave empty to apply to all locations.',
            nodes: 'Nodes',
            nodesDescription: 'Leave empty to apply to all nodes.',
            backupConfigurations: 'Backup Configurations',
            backupConfigurationsDescription: 'Leave empty to apply to all backup configurations.',
            eggs: 'Eggs',
            eggsPlaceholder: 'Select Eggs',
            dismissible: 'Dismissible',
          },
          enum: {
            announcementType: {
              info: 'Info',
              success: 'Success',
              warning: 'Warning',
              error: 'Error',
            },
          },
          create: {
            title: 'Create Announcement',
          },
          update: {
            title: 'Update Announcement',
          },
        },
        assets: {
          title: 'Assets',
          button: {
            newDirectory: 'New Directory',
            upload: 'Upload',
            copyLink: 'Copy Link',
          },
          dropzone: {
            title: 'Drop files here to upload',
            subtitle: 'Release to start uploading',
          },
          operations: {
            waiting: 'Waiting: ',
            uploading: 'Uploading: ',
          },
          toast: {
            assetDeleted: 'Asset deleted.',
            assetsDeleted: '{assets} deleted.',
          },
          modal: {
            createDirectory: {
              title: 'New Directory',
              form: {
                directoryName: 'Directory name',
              },
              createdAs: 'Will be created at ',
            },
            deleteAssets: {
              title: 'Confirm Asset Deletion',
              content: 'Are you sure you want to delete `{count}` assets?',
            },
            deleteAsset: {
              title: 'Delete Asset',
              content: 'Are you sure you want to delete this asset? This action cannot be undone.',
            },
          },
        },
        extensions: {
          title: 'Extensions',
          unknownExtension: 'Unknown Extension',
          unknown: 'Unknown',
          alert: {
            noExtensions: 'No extensions installed.',
            heavyImageMissing:
              "You don't seem to be using the heavy image required to install extensions, see [here]({docsUrl}) on how to switch to it.",
          },
          button: {
            viewBuildLogs: 'View build logs',
            install: 'Install extension',
            rebuild: 'Rebuild extensions',
            configure: 'Configure',
            back: 'Back to Extensions',
            accept: 'Accept',
            decline: 'Decline',
          },
          tooltip: {
            building: 'The panel is currently building extension code. Please wait.',
            noPendingBuild: 'No pending extensions to build.',
            noBackend: 'Backend extension is required to configure this extension.',
            noConfigurationPage: 'This extension does not have a configuration page defined.',
            removeExtension: 'Remove extension',
          },
          badge: {
            frontendMissing: 'Frontend missing',
            backendMissing: 'Backend missing',
            pendingBuild: 'Pending build',
            pendingRemoval: 'Pending removal',
          },
          card: {
            version: 'Version',
            authors: 'Authors',
          },
          section: {
            pendingExtensions: 'Pending extensions',
            noPendingExtensions: 'No pending extensions.',
          },
          dropzone: {
            title: 'Drop some files here to install as Extensions',
            subtitle: 'Release to start installing',
          },
          toast: {
            buildStarted: 'Extension rebuild started successfully.',
            buildCompleted: 'Extension build completed. You may need to refresh the page.',
            added: 'Extension `{packageName}` added successfully.',
            removed: 'Extension `{packageName}` removed successfully.',
          },
          notFound: {
            title: 'Extension Not Found',
            content: 'Extension with package name "{packageName}" not found.',
          },
          configure: {
            title: 'Configure {packageName}',
            noConfigurationPage: 'This extension does not have a configuration page.',
          },
          modal: {
            buildLogs: {
              title: 'Build Logs',
              empty: 'No logs found.',
            },
            license: {
              title: 'License agreement',
              description:
                'The extension `{packageName}` requires you to accept the following license before it can be installed.',
            },
            remove: {
              title: 'Remove extension',
              content: 'Are you sure you want to remove the extension `{packageName}`? This action cannot be undone.',
              form: {
                removeMigrations: 'Do you want to remove & rollback the database migrations of this extension?',
              },
            },
          },
        },
        users: {
          title: 'Users',
          resourceName: 'User',
          tooltip: {
            admin: 'Admin',
            twoFactorEnabled: '2FA Enabled',
            twoFactorDisabled: '2FA Disabled',
            cannotImpersonateSelf: 'You cannot impersonate yourself.',
          },
          tabs: {
            servers: 'Servers',
            oauthLinks: 'OAuth Links',
            activity: 'Activity',
          },
          button: {
            disableTwoFactor: 'Disable Two Factor',
            sendPasswordResetEmail: 'Send Password Reset Email',
            impersonate: 'Impersonate',
          },
          form: {
            admin: 'Admin',
            role: 'Role',
            externalId: 'External ID',
          },
          table: {
            columns: {
              role: 'Role',
            },
          },
          modal: {
            delete: {
              title: 'Confirm User Deletion',
              content: 'Are you sure you want to delete **{username}**?',
            },
            disableTwoFactor: {
              title: 'Disable User Two Factor',
              content: 'Are you sure you want to remove the two factor of **{username}**?',
              button: {
                confirm: 'Disable',
              },
              toast: {
                disabled: 'User two factor disabled.',
              },
            },
            sendPasswordResetEmail: {
              title: 'Send Password Reset Email',
              content: 'Are you sure you want to send a password reset email to **{email}**?',
              button: {
                confirm: 'Send',
              },
              toast: {
                sent: 'Password reset email sent.',
              },
            },
          },
          create: {
            title: 'Create User',
          },
          update: {
            title: 'Update User',
          },
          activity: {
            title: 'User Activity',
          },
          servers: {
            title: 'User Servers',
            showOwnedOnly: "Only show users' owned servers",
          },
          oauthLinks: {
            title: 'User OAuth Links',
            toast: {
              added: 'OAuth Link added.',
              removed: 'OAuth Link removed.',
            },
            modal: {
              add: {
                title: 'Add OAuth Link',
                form: {
                  oauthProvider: 'OAuth Provider',
                },
              },
              delete: {
                title: 'Confirm OAuth Link Deletion',
                content: 'Are you sure you want to delete the **{provider}** connection from **{username}**?',
              },
            },
          },
        },
        locations: {
          title: 'Locations',
        },
        nodes: {
          title: 'Nodes',
        },
        servers: {
          title: 'Servers',
        },
        nests: {
          title: 'Nests',
        },
        eggConfigurations: {
          title: 'Egg Configurations',
        },
        eggRepositories: {
          title: 'Egg Repositories',
        },
        databaseHosts: {
          title: 'Database Hosts',
        },
        oAuthProviders: {
          title: 'OAuth Providers',
        },
        backupConfigurations: {
          title: 'Backup Configs',
        },
        mounts: {
          title: 'Mounts',
        },
        roles: {
          title: 'Roles',
        },
        activity: {
          title: 'Activity',
        },
      },
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
            transferCancelled: 'Server transfer cancelled.',
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
            suspended:
              'Your Server is currently suspended. No actions can be performed until the suspension is lifted.',
            suspendedAdmin:
              'This server is currently suspended. Since you are an administrator, you can still access the server, but actions are limited.',
            nodeMaintenance: 'Your Server is on a node that is currently under maintenance.',
            transferring: 'Your Server is currently being transferred to another node.',
            restoringBackup: 'Your Server is currently restoring from a backup. Please wait...',
            installing: 'Your Server is currently being installed. Please wait...',
            pendingRestart:
              'Your Server has pending changes that require a restart. Please restart your server to apply these changes.',
          },
          message: {
            serverMarkedAs: 'Server marked as {state}...',
            installFailed: 'Installation has failed.',
            installCompleted: 'Installation has completed successfully.',
            transferFailed: 'Transfer has failed.',
            transferCompleted: 'Transfer has completed successfully. Reconnecting to server...',
            pullingImage: "Your Server is currently pulling it's docker image. Please wait...",
            pulling: 'Pulling',
            extracting: 'Extracting',
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
          titleEditorPlaying: 'Playing {file}',
          titleEditorEditing: 'Editing {file}',
          titleEditorNew: 'New File',
          titleDiffRevisionVsCurrent: '{file} - Revision #{revision} vs Current',
          titleDiffRevisionVsRevision: '{file} - Revision #{previousRevision} vs #{revision}',
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
            uploadingFolder: 'Uploading folder: {folder} ({files})',
            waiting: 'Waiting: ',
            uploading: 'Uploading: ',
            compressing: 'Compressing {files} from {path}',
            decompressing: 'Decompressing {path}',
            pulling: 'Pulling {destination}',
            copying: 'Copying {path} to {destination}',
            copyingMany: 'Copying {files}',
            receivingRemote: 'Receiving {files} from remote server',
            sendingRemote: 'Sending {files} to remote server',
            rateLimited: 'Your upload has been rate limited. Waiting...',
            cancelAllUploads: 'Cancel all uploads',
            cancelAllOperations: 'Cancel all operations',
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
            allOperationsCancelled: 'All operations have been cancelled.',
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
            permissionsUpdatedMany: 'Permissions have been updated for {files}.',
            permissionsCouldNotBeUpdated: 'Permissions could not be updated.',
            fileSaved: 'File has been saved.',
          },
          tooltip: {
            fileHistory: 'File History',
            largestDirectories: 'Analyze directory sizes',
            back: 'Back {seconds} seconds',
            forward: 'Forward {seconds} seconds',
            play: 'Play',
            pause: 'Pause',
            mute: 'Mute',
            unmute: 'Unmute',
          },
          drawer: {
            revisions: {
              title: 'File History',
              noRevisions: 'No revisions found for this file.',
              restored: 'Revision restored into editor.',
              badge: {
                fullSnapshot: 'Full Snapshot',
              },
              tooltip: {
                restore: 'Restore this revision into the editor',
                viewDiff: 'View diff against current file',
                compareToPrevious: 'Compare to previous revision',
              },
              diff: {
                original: 'Revision',
                current: 'Current',
              },
            },
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
            draftRestore: {
              title: 'Restore Draft',
              content: 'A draft of this file was found in your browser. Would you like to restore it?',
              contentHashMismatch:
                'The file has been modified on the server since this draft was saved. Restoring the draft may overwrite those changes.',
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
              form: {
                recursive: 'Apply changes recursively to all files and subdirectories within this directory',
              },
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
            largestDirectories: {
              title: 'Largest Directories',
              empty: 'No directories found.',
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
          form: {
            databaseName: 'Database Name',
          },
          modal: {
            createDatabase: {
              title: 'Create Database',
              toast: {
                created: 'Database created.',
              },
              form: {
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
            recreateDatabase: {
              title: 'Confirm Database Recreation',
              content:
                'Recreating a database will permanently delete all data in the **{name}** database and create a new one with the same connection details.',
              toast: {
                recreated: 'Database recreated.',
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
          subtitle: '{current} of {max} maximum schedules created.',
          dropzone: {
            title: 'Drop some files here to import them as Schedules',
            subtitle: 'Release to start importing',
          },
          tooltip: {
            limitReached: 'This server is limited to {max} schedules.',
          },
          table: {
            columns: {
              lastRun: 'Last Run',
              lastFailure: 'Last Failure',
              status: 'Status',
            },
          },
          button: {
            import: 'Import',
            trigger: 'Trigger',
            triggerWithCondition: 'Trigger (do not skip condition)',
            triggerSkipCondition: 'Trigger (skip condition)',
            addTrigger: 'Add Trigger',
            addCondition: 'Add Condition',
            addStep: 'Add Step',
            createFirstStep: 'Create First Step',
            addOutput: 'Add Output',
            addFile: 'Add File',
            exitEditor: 'Exit Editor',
          },
          toast: {
            imported: 'Schedule imported.',
            created: 'Schedule created.',
            updated: 'Schedule updated.',
            deleted: 'Schedule deleted.',
            triggered: 'Schedule triggered.',
            exported: 'Schedule exported.',
            parseError: 'Failed to parse schedule: {error}',
            step: {
              created: 'Schedule step created.',
              updated: 'Schedule step updated.',
              deleted: 'Schedule step deleted.',
            },
          },
          enum: {
            schedulePreConditionType: {
              none: 'None',
              and: 'AND (All must be true)',
              or: 'OR (Any must be true)',
              not: 'NOT (Must not be true)',
              serverState: 'Server State',
              uptime: 'Uptime',
              cpuUsage: 'CPU Usage',
              memoryUsage: 'Memory Usage',
              diskUsage: 'Disk Usage',
              fileExists: 'File Exists',
            },
            scheduleConditionType: {
              none: 'None',
              and: 'AND (All must be true)',
              or: 'OR (Any must be true)',
              not: 'NOT (Must not be true)',
              variableExists: 'Variable Exists',
              variableContains: 'Variable Contains',
              variableEquals: 'Variable Equals',
              variableStartsWith: 'Variable Starts With',
              variableEndsWith: 'Variable Ends With',
            },
            scheduleComparator: {
              smallerThan: 'Smaller than',
              smallerThanOrEqual: 'Smaller than or equal to',
              equal: 'Equal to',
              greaterThanOrEqual: 'Greater than or equal to',
              greaterThan: 'Greater than',
            },
          },
          modal: {
            createSchedule: {
              title: 'Create Schedule',
            },
            updateSchedule: {
              title: 'Update Schedule',
            },
            deleteSchedule: {
              title: 'Confirm Schedule Deletion',
              content: 'Are you sure you want to delete {name} from this server?',
            },
            createStep: {
              title: 'Create Schedule Step',
            },
            editStep: {
              title: 'Edit Schedule Step',
            },
            deleteStep: {
              title: 'Confirm Schedule Step Deletion',
              content: 'Are you sure you want to delete this schedule step?',
            },
          },
          view: {
            badge: {
              running: 'Running',
            },
            tooltip: {
              cannotTrigger: 'Cannot trigger a disabled schedule',
            },
            tabs: {
              actions: 'Actions',
              conditions: 'Conditions',
              triggers: 'Triggers',
            },
            sections: {
              actions: 'Schedule Actions',
              preConditions: 'Schedule Pre-Conditions',
              triggers: 'Schedule Triggers',
            },
            alert: {
              noActions: 'No actions configured for this schedule',
              noTriggers: 'No triggers configured for this schedule',
            },
          },
          form: {
            scheduleName: 'Schedule Name',
            enabled: 'Enabled',
            triggersList: 'Triggers',
            triggerNumber: 'Trigger {number}',
            actionType: 'Action Type',
            conditionType: 'Condition Type',
            serverState: 'Server State',
            comparator: 'Comparator',
            rootPath: 'Root Path',
            outputInto: 'Output into',
            caseInsensitive: 'Case Insensitive',
            ignoreFailure: 'Ignore Failure',
            runInForeground: 'Run in Foreground',
          },
          condition: {
            variable: 'Variable',
            equals: 'Equals',
            contains: 'Contains',
            startsWith: 'Starts With',
            endsWith: 'Ends With',
            allMustBeTrue: 'All conditions must be true:',
            anyMustBeTrue: 'Any condition must be true:',
            mustNotBeTrue: 'Condition must not be true:',
          },
          preCondition: {
            valueSeconds: 'Value (seconds)',
            valuePercent: 'Value (%)',
            value: 'Value',
            filePath: 'File Path',
          },
          triggers: {
            cron: {
              title: 'Cron',
              form: {
                cronSchedule: 'Cron Schedule',
              },
              card: {
                content: 'On Cron Interval {schedule}, Next run is {timestamp} - Last run was {lastTimestamp}.',
              },
              invalidCron: 'Invalid cron expression',
            },
            powerAction: {
              title: 'Power Action',
              form: {
                powerAction: 'Power Action',
              },
              card: {
                content: 'When Power Action `{action}` is requested.',
              },
            },
            serverState: {
              title: 'Server State',
              card: {
                content: 'When Server State `{state}` is reached.',
              },
            },
            backupStatus: {
              title: 'Backup Status',
              form: {
                backupStatus: 'Backup Status',
              },
              card: {
                content: 'When Backup reaches Status `{status}`.',
              },
            },
            consoleLine: {
              title: 'Console Line',
              form: {
                lineContains: 'Line Contains',
              },
              card: {
                content: 'When Console Output reaches line that contains `{contains}`',
              },
            },
            crash: {
              title: 'Crash',
              card: {
                content: 'When Server crashes.',
              },
            },
          },
          renderer: {
            noActionSelected: 'Select an action type to configure',
            noActionDetails: 'Action details not available',
            ignoreFailure: 'Ignore Failure: {value}',
            foreground: 'Foreground: {value}',
          },
          steps: {
            empty: {
              title: 'No Steps Configured',
              description: "This schedule doesn't have any steps yet. Add some actions to get started.",
            },
            sleep: {
              title: 'Sleep',
              form: {
                duration: 'Duration (milliseconds)',
              },
              renderer: {
                compact: 'Sleep for {duration}ms',
              },
            },
            ensure: {
              title: 'Ensure',
              renderer: {
                compact: 'Ensure a condition matches',
              },
            },
            format: {
              title: 'Format',
              form: {
                formatString: 'Format String',
                formatStringDescription: 'The format string, can include variables by wrapping inside {wrapper}',
              },
              renderer: {
                compact: 'Format a string into {outputInto}',
              },
            },
            matchRegex: {
              title: 'Match Regex',
              form: {
                input: 'Input',
                regex: 'Regex',
                outputs: 'Outputs',
                outputNumber: 'Output {number}',
              },
              renderer: {
                compact: 'Match {input} with regex {regex}',
              },
            },
            waitForConsoleLine: {
              title: 'Wait for Console Line',
              form: {
                lineContains: 'Line contains',
                timeout: 'Timeout (milliseconds)',
              },
              renderer: {
                compact: 'Wait {timeout} for console line containing {contains}',
                detail: {
                  lineContains: 'Line must contain: {contains}',
                  caseInsensitive: 'Case insensitive: {value}',
                  timeout: 'Timeout: {timeout}',
                },
              },
            },
            sendCommand: {
              title: 'Send Command',
              form: {
                command: 'Command',
              },
              renderer: {
                compact: 'Run {command}',
                detail: {
                  command: 'Command: {command}',
                },
              },
            },
            sendPower: {
              title: 'Send Power Signal',
              form: {
                powerAction: 'Power Action',
              },
              renderer: {
                compact: 'Do {action}',
                detail: {
                  powerAction: 'Power Action: {action}',
                },
              },
            },
            createBackup: {
              title: 'Create Backup',
              form: {
                backupName: 'Backup Name',
                ignoredFiles: 'Ignored Files',
              },
              renderer: {
                compact: 'Create {name}',
                detail: {
                  backupName: 'Backup Name: {name}',
                  ignoredFiles: 'Ignored Files: {files}',
                },
              },
            },
            createDirectory: {
              title: 'Create Directory',
              form: {
                directoryName: 'Directory Name',
              },
              renderer: {
                compact: 'Create {name} in {root}',
                detail: {
                  directory: 'Directory: {name}',
                  root: 'Root: {root}',
                },
              },
            },
            writeFile: {
              title: 'Write File',
              form: {
                filePath: 'File Path',
                content: 'Content',
                appendToFile: 'Append to File',
              },
              renderer: {
                compact: 'Write to {file}',
                detail: {
                  file: 'File: {file}',
                  append: 'Append: {value}',
                },
              },
            },
            copyFile: {
              title: 'Copy File',
              form: {
                sourceFile: 'Source File',
                destination: 'Destination',
              },
              renderer: {
                compact: 'Copy {file} to {destination}',
                detail: {
                  from: 'From: {file}',
                  to: 'To: {destination}',
                },
              },
            },
            deleteFiles: {
              title: 'Delete Files',
              form: {
                filesToDelete: 'Files to Delete',
              },
              renderer: {
                compact: 'Delete {files}',
                detail: {
                  root: 'Root: {root}',
                  files: 'Files: {files}',
                },
              },
            },
            renameFiles: {
              title: 'Rename Files',
              form: {
                files: 'Files',
                from: 'from',
                to: 'to',
              },
              renderer: {
                compact: 'Rename {files}',
                detail: {
                  root: 'Root: {root}',
                  files: 'Files: {files}',
                },
              },
            },
            compressFiles: {
              title: 'Compress Files',
              form: {
                filesToCompress: 'Files to Compress',
                archiveFormat: 'Archive Format',
                archiveName: 'Archive Name',
              },
              renderer: {
                compact: 'Compress {files} in {root} to {name}',
                detail: {
                  output: 'Output: {name}',
                  root: 'Root: {root}',
                  format: 'Format: {format}',
                  files: 'Files: {files}',
                },
              },
            },
            decompressFile: {
              title: 'Decompress File',
              form: {
                file: 'File',
              },
              renderer: {
                compact: 'Decompress {file} to {root}',
                detail: {
                  file: 'File: {file}',
                  root: 'Root: {root}',
                },
              },
            },
            updateStartupVariable: {
              title: 'Update Startup Variable',
              form: {
                envVariable: 'Environment Variable',
                value: 'Value',
              },
              renderer: {
                compact: 'Set {variable} to {value}',
                detail: {
                  variable: 'Variable: {variable}',
                  value: 'Value: {value}',
                },
              },
            },
            updateStartupCommand: {
              title: 'Update Startup Command',
              form: {
                startupCommand: 'Startup Command',
              },
              renderer: {
                compact: 'Set to {command}',
                detail: {
                  command: 'Command: {command}',
                },
              },
            },
            updateStartupDockerImage: {
              title: 'Update Docker Image',
              form: {
                dockerImage: 'Docker Image',
              },
              renderer: {
                compact: 'Set to {image}',
                detail: {
                  image: 'Image: {image}',
                },
              },
            },
          },
        },
        subusers: {
          title: 'Subusers',
          subtitle: '{current} of {max} maximum subusers created.',
          tooltip: {
            limitReached: 'This server is limited to {max} subusers.',
          },
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
                ignoredFilesDescription:
                  'Files and directories matching these patterns will be hidden from this subuser. Uses gitignore-style glob patterns (e.g. `*.env`, `secrets/`). Prefix a pattern with `!` to un-hide a path that a broader pattern would otherwise exclude.',
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
              form: {
                restoreStartup: 'Restore the startup command, image, and variables from this backup.',
              },
            },
            deleteBackup: {
              title: 'Confirm Backup Deletion',
              content: 'Are you sure you want to delete **{name}** from this server?',
              toast: {
                deleted: 'Backup deleted.',
              },
            },
            viewMetadata: {
              title: 'Backup Metadata',
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
          modal: {
            unsavedChanges: {
              title: 'Unsaved Changes',
              content:
                'You have unsaved changes to your startup variables. Are you sure you want to leave this page? If you leave, your changes will be lost.',
              button: {
                leave: 'Leave Page',
              },
            },
          },
          noVariables: 'No startup variables found for this server.',
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
          button: {
            attach: 'Attach',
            detach: 'Detach',
          },
          modal: {
            attachMount: {
              title: 'Attach Mount',
              content: 'Do you want to attach **{name}** to `{target}`?',
              toast: {
                attached: '{name} has been mounted to your server.',
              },
            },
            detachMount: {
              title: 'Detach Mount',
              content: 'Do you want to detach **{name}** from `{target}`?',
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
          button: {
            clearUserFilter: 'Clear User Filter',
          },
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
