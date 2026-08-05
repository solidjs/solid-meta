import {
  Component,
  createComponent,
  createContext,
  createSignal,
  merge,
  omit,
  onCleanup,
  ParentComponent,
  useContext
} from "solid-js";
import { useHead, HeadTag, JSX } from "@solidjs/web";

export { useHead } from "@solidjs/web";
export type { HeadTag } from "@solidjs/web";

type GroupRegister = (tag: HeadTag) => void;

// Established by <Head> so tag components rendered within its extent join
// its replacement set instead of registering standalone.
const HeadGroupContext = createContext<GroupRegister | null>(null);

// The head registry treats `children` as a text body (String()-ed), but JSX
// children may arrive as nested arrays with embedded getters — resolve and
// join them.
const flattenChildren = (children: unknown): string => {
  if (typeof children === "function") return flattenChildren((children as () => unknown)());
  if (Array.isArray(children)) return children.map(flattenChildren).join("");
  return children == null ? "" : String(children);
};

function headTag(
  tag: HeadTag["tag"],
  props: { key?: string } & Record<string, any>,
  body?: boolean
): null {
  const tagProps = omit(props, "key", "children");
  const desc: HeadTag = {
    tag,
    props: body
      ? merge(tagProps, {
          get children() {
            return flattenChildren(props.children);
          }
        })
      : tagProps,
    key: () => props.key as string
  };
  const group = useContext(HeadGroupContext);
  if (group) group(desc);
  else useHead(desc);
  return null;
}

/**
 * Groups its child head tags into one replacement set: same-identity tags
 * within the group coexist (e.g. several `og:image`s), and a later group
 * replaces an earlier group's set per identity wholesale, restoring it when
 * disposed. Group scope propagates via context through component calls, so
 * tags rendered by child components join the set. A `<Head>` inside another
 * `<Head>`'s extent forms its own independent group; render bare tag
 * components instead to contribute to the surrounding set.
 */
export const Head: ParentComponent = props => {
  // Membership lives in a plain array (registration happens during child
  // render); the dirty signal re-runs the group's registration on change —
  // an intentional owned-scope write.
  const tags: HeadTag[] = [];
  const [dirty, setDirty] = createSignal(undefined, { equals: false, ownedWrite: true });
  const register: GroupRegister = tag => {
    tags.push(tag);
    setDirty(undefined);
    onCleanup(() => {
      tags.splice(tags.indexOf(tag), 1);
      setDirty(undefined);
    });
  };
  useHead(() => {
    dirty();
    return tags.slice();
  });
  // Hand-written equivalent of <HeadGroupContext value={register}>
  // {props.children}</HeadGroupContext> — keeps the package JSX-free.
  return createComponent(
    HeadGroupContext as unknown as Component<{ value: GroupRegister; children?: JSX.Element }>,
    {
      value: register,
      get children() {
        return props.children;
      }
    }
  );
};

export const Title: Component<JSX.HTMLAttributes<HTMLTitleElement> & { key?: string }> = props =>
  headTag("title", props, true);

export const Style: Component<JSX.StyleHTMLAttributes<HTMLStyleElement> & { key?: string }> =
  props => headTag("style", props, true);

export const Script: Component<JSX.ScriptHTMLAttributes<HTMLScriptElement> & { key?: string }> =
  props => headTag("script", props, true);

export const Meta: Component<JSX.MetaHTMLAttributes<HTMLMetaElement> & { key?: string }> = props =>
  headTag("meta", props);

export const Link: Component<JSX.LinkHTMLAttributes<HTMLLinkElement> & { key?: string }> = props =>
  headTag("link", props);

export const Base: Component<JSX.BaseHTMLAttributes<HTMLBaseElement>> = props =>
  headTag("base", props);

export const Stylesheet: Component<
  Omit<JSX.LinkHTMLAttributes<HTMLLinkElement>, "rel"> & { key?: string }
> = props => headTag("link", merge(props, { rel: "stylesheet" }));
