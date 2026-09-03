import { faMinus, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { CSSProperties, ReactNode } from 'react';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Text from '@/elements/typography/Text.tsx';

/**
 * The combinator node types this builder knows how to nest. They are hidden from the type picker
 * once {@link RecursiveGroupBuilderProps.maxDepth} is reached so a tree can't grow without bound.
 */
const GROUP_TYPES = ['and', 'or', 'not'];

const nestedStyle: CSSProperties = {
  marginLeft: 'clamp(6px, 3vw, 20px)',
  paddingLeft: 10,
  borderLeft: '2px solid var(--mantine-color-default-border)',
};

export interface RecursiveGroupBuilderProps<T extends { type: string }> {
  node: T;
  onChange: (node: T) => void;
  depth?: number;
  maxDepth?: number;
  /** Options for the type picker; `value` must match a node `type`. */
  typeData: { value: string; label: string }[];
  /** Builds a fresh node of the given type (called when the picker changes). */
  makeDefault: (type: string) => T;
  /** Child list for `and`/`or` nodes, or `null` for any other type. */
  getChildren: (node: T) => T[] | null;
  /** Returns a copy of an `and`/`or` node with its child list replaced. */
  withChildren: (node: T, children: T[]) => T;
  /** Single child of a `not` node, or `null` for any other type. */
  getNotChild: (node: T) => T | null;
  /** Returns a copy of a `not` node with its child replaced. */
  withNotChild: (node: T, child: T) => T;
  /** Blank node inserted when adding a row to an `and`/`or` group. */
  emptyNode: T;
  /** Renders the editors for a leaf (non-combinator) node. */
  renderLeaf: (node: T, onChange: (node: T) => void) => ReactNode;
  labels: {
    type: string;
    allMustMatch: string;
    anyMustMatch: string;
    mustNotMatch: string;
    addChild: string;
  };
}

/**
 * Recursive editor for a boolean-expression tree - `none` / `and` / `or` / `not` plus
 * caller-defined leaves. Owns the type picker, the nesting/indentation, the depth cap and the
 * add/remove-child controls; the caller supplies the leaf editors and the accessors that read and
 * rebuild its particular node shape.
 */
export default function RecursiveGroupBuilder<T extends { type: string }>({
  node,
  onChange,
  depth = 0,
  maxDepth = 3,
  typeData,
  makeDefault,
  getChildren,
  withChildren,
  getNotChild,
  withNotChild,
  emptyNode,
  renderLeaf,
  labels,
}: RecursiveGroupBuilderProps<T>) {
  const forward = {
    maxDepth,
    typeData,
    makeDefault,
    getChildren,
    withChildren,
    getNotChild,
    withNotChild,
    emptyNode,
    renderLeaf,
    labels,
  };

  const children = getChildren(node);
  const notChild = getNotChild(node);

  return (
    <div style={depth > 0 ? nestedStyle : undefined}>
      <Stack>
        <Select
          withAsterisk
          label={labels.type}
          value={node.type}
          onChange={(value) => value && onChange(makeDefault(value))}
          data={typeData.filter((option) => depth < maxDepth || !GROUP_TYPES.includes(option.value))}
        />

        {renderLeaf(node, onChange)}

        {children && (
          <>
            {depth < maxDepth && (
              <Group>
                <Text size='sm'>{node.type === 'and' ? labels.allMustMatch : labels.anyMustMatch}</Text>
                <Button
                  size='xs'
                  variant='light'
                  leftSection={<FontAwesomeIcon icon={faPlus} />}
                  onClick={() => onChange(withChildren(node, [...children, emptyNode]))}
                >
                  {labels.addChild}
                </Button>
              </Group>
            )}

            {children.map((child, index) => (
              <Group key={index} align='flex-start'>
                <div style={{ flex: 1 }}>
                  <RecursiveGroupBuilder
                    {...forward}
                    node={child}
                    depth={depth + 1}
                    onChange={(updated) =>
                      onChange(
                        withChildren(
                          node,
                          children.map((current, i) => (i === index ? updated : current)),
                        ),
                      )
                    }
                  />
                </div>
                <ActionIcon
                  color='red'
                  variant='light'
                  onClick={() =>
                    onChange(
                      withChildren(
                        node,
                        children.filter((_, i) => i !== index),
                      ),
                    )
                  }
                >
                  <FontAwesomeIcon icon={faMinus} />
                </ActionIcon>
              </Group>
            ))}
          </>
        )}

        {notChild && (
          <>
            <Text size='sm'>{labels.mustNotMatch}</Text>
            <div style={{ flex: 1 }}>
              <RecursiveGroupBuilder
                {...forward}
                node={notChild}
                depth={depth + 1}
                onChange={(updated) => onChange(withNotChild(node, updated))}
              />
            </div>
          </>
        )}
      </Stack>
    </div>
  );
}
