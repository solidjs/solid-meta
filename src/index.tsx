import {
  Component,
  createRenderEffect,
  createUniqueId,
  JSX,
  onCleanup,
  ParentComponent,
  useContext
} from "solid-js";
import { isServer, spread } from "solid-js/web";
import { createContext } from "solid-js";

export const MetaContext = createContext<MetaContextType>();

interface TagDescription {
  tag: string;
  props: Record<string, unknown>;
  id: string;
  name?: string;
  ref?: Element;
}

export interface MetaContextType {
  addClientTag: (tag: TagDescription) => number;

  // shouldRenderTag: (tag: string, index: number) => boolean;

  removeClientTag: (tag: TagDescription, index: number) => void;

  addServerTag?: (tagDesc: TagDescription) => void;
}

const cascadingTags = ["title", "meta"];

const tagProp = (tag: TagDescription) => tag.tag + (tag.name ? `.${tag.name}"` : "");

const MetaProvider: ParentComponent<{ tags?: Array<TagDescription> }> = props => {
  const tags = new Map();
  function getElement(tag: TagDescription) {
    if (tag.ref) {
      return tag.ref;
    }

    let el = document.querySelector(`[data-sm="${tag.id}"]`);
    if (el) {
      if (el.tagName.toLowerCase() !== tag.tag) {
        if (el.parentNode) {
          // remove the old tag
          el.parentNode.removeChild(el);
        }
        // add the new tag
        el = document.createElement(tag.tag);
      }
      // use the old tag
      el.removeAttribute("data-sm");
    } else {
      // create a new tag
      el = document.createElement(tag.tag);
    }

    return el;
  }

  const actions: MetaContextType = {
    addClientTag: (tag: TagDescription) => {
      let tagName = tagProp(tag);

      if (cascadingTags.indexOf(tag.tag) !== -1) {
        //  only cascading tags need to be kept as singletons
        if (!tags.has(tagName)) {
          tags.set(tagName, []);
        }

        let t = tags.get(tagName);
        let index = t.length;

        let lastVisited = null;
        for (var i = index - 1; i >= 0; i--) {
          if (t[i] != null) {
            lastVisited = t[i];
            break;
          }
        }

        t = [...t, tag];

        // track indices synchronously
        tags.set(tagName, t);

        if (!isServer) {
          let element = getElement(tag);
          tag.ref = element;

          spread(element, () => tag.props);

          if (element.parentNode != document.head) {
            document.head.appendChild(element);
          }

          if (lastVisited && lastVisited.ref) {
            document.head!.removeChild(lastVisited.ref);
          }
        }

        return index;
      }

      if (!isServer) {
        let element = getElement(tag);
        tag.ref = element;

        spread(element, () => tag.props);

        if (element.parentNode != document.head) {
          document.head.appendChild(element);
        }
      }

      return -1;
    },

    removeClientTag: (tag: TagDescription, index: number) => {
      const tagName = tagProp(tag);

      if (tag.ref) {
        if (tag.ref.parentNode) {
          tag.ref.parentNode.removeChild(tag.ref);
        }

        const t = tags.get(tagName);
        if (t) {
          for (let i = index - 1; i >= 0; i--) {
            if (t[i] != null) {
              document.head.appendChild(t[i].ref);
            }
          }
          t[index] = null;
          tags.set(tagName, t);
        }
      }
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

  const { addClientTag, removeClientTag, addServerTag } = c;

  createHeadTag({
    tag,
    props,
    id,
    get name() {
      return props.name || props.property;
    }
  });

  if (isServer) {
    addServerTag!({ tag, props, id });
    return null;
  }

  return null;
};

export { MetaProvider };

function createHeadTag(tagDesc: {
  tag: string;
  props: { [k: string]: any };
  id: string;
  name: any;
}) {
  const { addClientTag, removeClientTag } = useContext(MetaContext)!;

  createRenderEffect(() => {
    if (!isServer) {
      let index = addClientTag(tagDesc);
      onCleanup(() => removeClientTag(tagDesc, index));
    }
  });
}

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
