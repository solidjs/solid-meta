import {
  createSignal,
  createContext,
  createComputed,
  onMount,
  onCleanup,
  useContext,
  Component,
  ParentComponent,
  JSX,
  createUniqueId,
  createRenderEffect
} from "solid-js";
import { isServer, spread } from "solid-js/web";

interface TagDescription {
  tag: string;
  props: Record<string, unknown>;
  id: string;
}

interface MetaContextType {
  addClientTag: (tag: string, name: string) => number;

  shouldRenderTag: (tag: string, index: number) => boolean;

  removeClientTag: (tag: string, index: number) => void;

  addServerTag?: (tagDesc: TagDescription) => void;
}

const MetaContext = createContext<MetaContextType>();

const cascadingTags = ["title", "meta"];

const MetaProvider: ParentComponent<{ tags?: Array<TagDescription> }> = props => {
  const indices = new Map(),
    [tags, setTags] = createSignal<{ [k: string]: (string | null)[] }>({});

  onMount(() => {
    const ssrTags = document.head.querySelectorAll(`[data-sm=""]`);
    // `forEach` on `NodeList` is not supported in Googlebot, so use a workaround
    Array.prototype.forEach.call(ssrTags, (ssrTag: Node) => ssrTag.parentNode!.removeChild(ssrTag));
  });

  const actions: MetaContextType = {
    addClientTag: (tag: string, name: string) => {
      // consider only cascading tags
      if (cascadingTags.indexOf(tag) !== -1) {
        setTags(tags => {
          const names = tags[tag] || [];
          return { ...tags, [tag]: [...names, name] };
        });
        // track indices synchronously
        const index = indices.has(tag) ? indices.get(tag) + 1 : 0;
        indices.set(tag, index);
        return index;
      }
      return -1;
    },

    shouldRenderTag: (tag: string, index: number) => {
      if (cascadingTags.indexOf(tag) !== -1) {
        const names = tags()[tag];
        // check if the tag is the last one of similar
        return names && names.lastIndexOf(names[index]) === index;
      }
      return true;
    },

    removeClientTag: (tag: string, index: number) => {
      setTags(tags => {
        const names = tags[tag];
        if (names) {
          names[index] = null;
          return { ...tags, [tag]: names };
        }
        return tags;
      });
    }
  };

  if (isServer) {
    actions.addServerTag = (tagDesc: TagDescription) => {
      const { tags = [] } = props;
      // tweak only cascading tags
      if (cascadingTags.indexOf(tagDesc.tag) !== -1) {
        const index = tags.findIndex(prev => {
          const prevName = prev.props.name || prev.props.property;
          const nextName = tagDesc.props.name || tagDesc.props.property;
          return prev.tag === tagDesc.tag && prevName === nextName;
        });
        if (index !== -1) {
          tags.splice(index, 1);
        }
      }
      tags.push(tagDesc);
    };

    if (Array.isArray(props.tags) === false) {
      throw Error("tags array should be passed to <MetaProvider /> in node");
    }
  }

  return <MetaContext.Provider value={actions}>{props.children}</MetaContext.Provider>;
};

const MetaTag = (tag: string, props: { [k: string]: any }) => {
  const id = createUniqueId();
  const c = useContext(MetaContext);
  if (!c) throw new Error("<MetaProvider /> should be in the tree");
  const { addClientTag, removeClientTag, addServerTag, shouldRenderTag } = c;

  let index = -1;
  createComputed(() => {
    index = addClientTag(tag, props.name || props.property);
    onCleanup(() => removeClientTag(tag, index));
  });

  if (isServer) {
    addServerTag!({ tag, props, id });
    return null;
  }

  createRenderEffect(() => {
    let el: HTMLElement | null = null;
    if (shouldRenderTag(tag, index)) {
      el = document.querySelector(`[data-sm="${id}"]`);

      if (el) {
        if (el.tagName.toLowerCase() !== tag) {
          if (el.parentNode) {
            // remove the old tag
            el.parentNode.removeChild(el);
          }

          // add the new tag
          el = document.createElement(tag);
          el.setAttribute("data-sm", id);
          document.head.appendChild(el);
        }

        // use the old tag
      } else {
        // create a new tag
        el = document.createElement(tag);
        el.setAttribute("data-sm", id);
        document.head.appendChild(el);
      }

      // update the tag
      spread(el, props);
    }

    onCleanup(() => {
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });
  });

  return null;
};

export { MetaProvider };

export function renderTags(tags: Array<TagDescription>) {
  return tags
    .map(tag => {
      const keys = Object.keys(tag.props);
      const props = keys.map(k => (k === "children" ? "" : ` ${k}="${tag.props[k]}"`)).join("");
      return tag.props.children
        ? `<${tag.tag} data-sm="${tag.id}"${props}>${
            // Tags might contain multiple text children:
            //   <Title>example - {myCompany}</Title>
            Array.isArray(tag.props.children) ? tag.props.children.join("") : tag.props.children
          }</${tag.tag}>`
        : `<${tag.tag} data-sm="${tag.id}"${props}/>`;
    })
    .join("");
}

export const Title: Component<JSX.HTMLAttributes<HTMLTitleElement>> = props =>
  MetaTag("title", props);

export const Style: Component<JSX.StyleHTMLAttributes<HTMLStyleElement>> = props =>
  MetaTag("style", props);

export const Meta: Component<JSX.MetaHTMLAttributes<HTMLMetaElement>> = props =>
  MetaTag("meta", props);

export const Link: Component<JSX.LinkHTMLAttributes<HTMLLinkElement>> = props =>
  MetaTag("link", props);

export const Base: Component<JSX.BaseHTMLAttributes<HTMLBaseElement>> = props =>
  MetaTag("base", props);

export const Stylesheet: Component<
  Omit<JSX.LinkHTMLAttributes<HTMLLinkElement>, "rel">
> = props => <Link rel="stylesheet" {...props} />;
