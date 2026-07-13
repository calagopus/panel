import {
  ActionIcon,
  Alert,
  Avatar,
  Badge,
  Blockquote,
  Button,
  Checkbox,
  Chip,
  Indicator,
  type MantineThemeOverride,
  Mark,
  NavLink,
  Pagination,
  Radio,
  SegmentedControl,
  Stepper,
  Switch,
  ThemeIcon,
  Timeline,
  Tooltip,
} from '@mantine/core';
import { NEUTRAL_COLORS } from './colors.ts';

export const shadcnComponentColorOverrides: MantineThemeOverride['components'] = {
  Checkbox: Checkbox.extend({
    vars: (theme, props) => {
      const colorKey = props.color && Object.keys(theme.colors).includes(props.color) ? props.color : undefined;
      return {
        root: {
          '--checkbox-color': colorKey
            ? `var(--mantine-color-${colorKey}-filled)`
            : 'var(--mantine-primary-color-filled)',
          '--checkbox-icon-color': colorKey
            ? `var(--mantine-color-${colorKey}-contrast)`
            : 'var(--mantine-primary-color-contrast)',
        },
      };
    },
  }),
  Chip: Chip.extend({
    vars: (theme, props) => {
      const colorKey = props.color && Object.keys(theme.colors).includes(props.color) ? props.color : undefined;
      const variant = props.variant ?? 'filled';
      return {
        root: {
          '--chip-bg':
            variant !== 'light'
              ? colorKey
                ? `var(--mantine-color-${colorKey}-filled)`
                : 'var(--mantine-primary-color-filled)'
              : undefined,
          '--chip-color':
            variant === 'filled'
              ? colorKey
                ? `var(--mantine-color-${colorKey}-contrast)`
                : 'var(--mantine-primary-color-contrast)'
              : undefined,
        },
      };
    },
  }),
  Radio: Radio.extend({
    vars: (theme, props) => ({
      root: {
        '--radio-color': props.color
          ? Object.keys(theme.colors).includes(props.color)
            ? `var(--mantine-color-${props.color}-filled)`
            : props.color
          : 'var(--mantine-primary-color-filled)',
        '--radio-icon-color': props.color
          ? Object.keys(theme.colors).includes(props.color)
            ? `var(--mantine-color-${props.color}-contrast)`
            : props.color
          : 'var(--mantine-primary-color-contrast)',
      },
    }),
  }),
  SegmentedControl: SegmentedControl.extend({
    vars: (theme, props) => ({
      root: {
        '--sc-color': props.color
          ? Object.keys(theme.colors).includes(props.color)
            ? NEUTRAL_COLORS.includes(props.color)
              ? 'var(--mantine-color-body)'
              : `var(--mantine-color-${props.color}-filled)`
            : props.color
          : 'var(--mantine-color-default)',
      },
    }),
  }),
  Switch: Switch.extend({
    styles: () => ({
      thumb: {
        backgroundColor: 'var(--mantine-color-default)',
        borderColor: 'var(--mantine-color-default-border)',
      },
      track: {
        borderColor: 'var(--mantine-color-default-border)',
      },
    }),
  }),
  ActionIcon: ActionIcon.extend({
    vars: (theme, props) => {
      const colorKey = props.color && Object.keys(theme.colors).includes(props.color) ? props.color : undefined;
      const isNeutralColor = colorKey && NEUTRAL_COLORS.includes(colorKey);
      const isNeutralPrimaryColor = !colorKey && NEUTRAL_COLORS.includes(theme.primaryColor);
      const variant = props.variant ?? 'filled';

      return {
        root: {
          '--ai-color':
            variant === 'filled'
              ? colorKey
                ? `var(--mantine-color-${colorKey}-contrast)`
                : 'var(--mantine-primary-color-contrast)'
              : variant === 'white'
                ? isNeutralColor || isNeutralPrimaryColor
                  ? 'var(--mantine-color-black)'
                  : undefined
                : undefined,
        },
      };
    },
  }),
  Button: Button.extend({
    vars: (theme, props) => {
      const colorKey = props.color && Object.keys(theme.colors).includes(props.color) ? props.color : undefined;
      const isNeutralColor = colorKey && NEUTRAL_COLORS.includes(colorKey);
      const isNeutralPrimaryColor = !colorKey && NEUTRAL_COLORS.includes(theme.primaryColor);
      const variant = props.variant ?? 'filled';
      return {
        root: {
          '--button-color':
            variant === 'filled'
              ? colorKey
                ? `var(--mantine-color-${colorKey}-contrast)`
                : 'var(--mantine-primary-color-contrast)'
              : variant === 'white'
                ? isNeutralColor || isNeutralPrimaryColor
                  ? 'var(--mantine-color-black)'
                  : undefined
                : undefined,
        },
      };
    },
  }),
  NavLink: NavLink.extend({
    vars: (theme, props) => {
      const colorKey = props.color && Object.keys(theme.colors).includes(props.color) ? props.color : undefined;
      const variant = props.variant ?? 'light';
      return {
        root: {
          '--nl-color':
            variant === 'filled'
              ? colorKey
                ? `var(--mantine-color-${colorKey}-contrast)`
                : 'var(--mantine-primary-color-contrast)'
              : undefined,
        },
        children: {},
      };
    },
  }),
  Pagination: Pagination.extend({
    vars: (theme, props) => {
      const colorKey = props.color && Object.keys(theme.colors).includes(props.color) ? props.color : undefined;
      return {
        root: {
          '--pagination-active-color': colorKey
            ? `var(--mantine-color-${colorKey}-contrast)`
            : 'var(--mantine-primary-color-contrast)',
        },
      };
    },
  }),
  Stepper: Stepper.extend({
    vars: (theme, props) => {
      const colorKey = props.color && Object.keys(theme.colors).includes(props.color) ? props.color : undefined;
      return {
        root: {
          '--stepper-icon-color': colorKey
            ? `var(--mantine-color-${colorKey}-contrast)`
            : 'var(--mantine-primary-color-contrast)',
        },
      };
    },
  }),
  Alert: Alert.extend({
    vars: (theme, props) => {
      const colorKey = props.color && Object.keys(theme.colors).includes(props.color) ? props.color : undefined;
      const isNeutralColor = colorKey && NEUTRAL_COLORS.includes(colorKey);
      const isNeutralPrimaryColor = !colorKey && NEUTRAL_COLORS.includes(theme.primaryColor);
      const variant = props.variant ?? 'light';
      return {
        root: {
          '--alert-color':
            variant === 'filled'
              ? colorKey
                ? `var(--mantine-color-${colorKey}-contrast)`
                : 'var(--mantine-primary-color-contrast)'
              : variant === 'white'
                ? isNeutralColor || isNeutralPrimaryColor
                  ? 'var(--mantine-color-black)'
                  : undefined
                : undefined,
        },
      };
    },
  }),
  Tooltip: Tooltip.extend({
    vars: () => ({
      tooltip: {
        '--tooltip-bg': 'var(--mantine-color-primary-color-filled)',
        '--tooltip-color': 'var(--mantine-color-primary-color-contrast)',
      },
    }),
  }),
  Avatar: Avatar.extend({
    vars: (theme, props) => {
      const colorKey = props.color && Object.keys(theme.colors).includes(props.color) ? props.color : undefined;
      const isNeutralColor = colorKey && NEUTRAL_COLORS.includes(colorKey);
      const isNeutralPrimaryColor = !colorKey && NEUTRAL_COLORS.includes(theme.primaryColor);
      const variant = props.variant ?? 'light';
      return {
        root: {
          '--avatar-bg':
            variant === 'filled'
              ? colorKey
                ? `var(--mantine-color-${colorKey}-filled)`
                : 'var(--mantine-primary-color-filled)'
              : variant === 'light'
                ? colorKey
                  ? `var(--mantine-color-${colorKey}-light)`
                  : 'var(--mantine-primary-color-light)'
                : undefined,

          '--avatar-color':
            variant === 'filled'
              ? colorKey
                ? `var(--mantine-color-${colorKey}-contrast)`
                : 'var(--mantine-primary-color-contrast)'
              : variant === 'light'
                ? colorKey
                  ? `var(--mantine-color-${colorKey}-light-color)`
                  : 'var(--mantine-primary-color-light-color)'
                : variant === 'white'
                  ? isNeutralColor || isNeutralPrimaryColor
                    ? 'var(--mantine-color-black)'
                    : colorKey
                      ? `var(--mantine-color-${colorKey}-outline)`
                      : 'var(--mantine-primary-color-filled)'
                  : variant === 'outline' || variant === 'transparent'
                    ? colorKey
                      ? `var(--mantine-color-${colorKey}-outline)`
                      : 'var(--mantine-primary-color-filled)'
                    : undefined,

          '--avatar-bd':
            variant === 'outline'
              ? colorKey
                ? `1px solid var(--mantine-color-${colorKey}-outline)`
                : '1px solid var(--mantine-primary-color-filled)'
              : undefined,
        },
      };
    },
  }),
  Badge: Badge.extend({
    vars: (theme, props) => {
      const colorKey = props.color && Object.keys(theme.colors).includes(props.color) ? props.color : undefined;
      const isNeutralColor = colorKey && NEUTRAL_COLORS.includes(colorKey);
      const isNeutralPrimaryColor = !colorKey && NEUTRAL_COLORS.includes(theme.primaryColor);
      const variant = props.variant ?? 'filled';
      return {
        root: {
          '--badge-bg': variant === 'filled' && colorKey ? `var(--mantine-color-${colorKey}-filled)` : undefined,
          '--badge-color':
            variant === 'filled'
              ? colorKey
                ? `var(--mantine-color-${colorKey}-contrast)`
                : 'var(--mantine-primary-color-contrast)'
              : variant === 'white'
                ? isNeutralColor || isNeutralPrimaryColor
                  ? 'var(--mantine-color-black)'
                  : undefined
                : undefined,
        },
      };
    },
  }),
  Indicator: Indicator.extend({
    vars: (theme, props) => {
      const colorKey = props.color && Object.keys(theme.colors).includes(props.color) ? props.color : undefined;
      return {
        root: {
          '--indicator-text-color': colorKey
            ? `var(--mantine-color-${colorKey}-contrast)`
            : 'var(--mantine-primary-color-contrast)',
        },
      };
    },
  }),
  ThemeIcon: ThemeIcon.extend({
    vars: (theme, props) => {
      const colorKey = props.color && Object.keys(theme.colors).includes(props.color) ? props.color : undefined;
      const isNeutralColor = colorKey && NEUTRAL_COLORS.includes(colorKey);
      const isNeutralPrimaryColor = !colorKey && NEUTRAL_COLORS.includes(theme.primaryColor);
      const variant = props.variant ?? 'filled';
      return {
        root: {
          '--ti-color':
            variant === 'filled'
              ? colorKey
                ? `var(--mantine-color-${colorKey}-contrast)`
                : 'var(--mantine-primary-color-contrast)'
              : variant === 'white'
                ? isNeutralColor || isNeutralPrimaryColor
                  ? 'var(--mantine-color-black)'
                  : undefined
                : undefined,
        },
      };
    },
  }),
  Timeline: Timeline.extend({
    vars: (theme, props) => {
      const colorKey = props.color && Object.keys(theme.colors).includes(props.color) ? props.color : undefined;
      return {
        root: {
          '--tl-icon-color': colorKey
            ? `var(--mantine-color-${colorKey}-contrast)`
            : 'var(--mantine-primary-color-contrast)',
        },
      };
    },
  }),
  Blockquote: Blockquote.extend({
    vars: (theme, props) => {
      const colorKey = props.color && Object.keys(theme.colors).includes(props.color) ? props.color : undefined;
      return {
        root: {
          '--bq-bg-dark': colorKey ? `var(--mantine-color-${colorKey}-light)` : 'var(--mantine-primary-color-light)',
          '--bq-bg-light': colorKey ? `var(--mantine-color-${colorKey}-light)` : 'var(--mantine-primary-color-light)',
        },
      };
    },
  }),
  Mark: Mark.extend({
    vars: (theme, props) => {
      const colorKey = props.color && Object.keys(theme.colors).includes(props.color) ? props.color : 'yellow';
      const isNeutralColor = NEUTRAL_COLORS.includes(colorKey);
      return {
        root: {
          '--mark-bg-light': `var(--mantine-color-${colorKey}-${isNeutralColor ? '3' : 'filled-hover'})`,
          '--mark-bg-dark': `var(--mantine-color-${colorKey}-filled)`,
        },
      };
    },
  }),
};
