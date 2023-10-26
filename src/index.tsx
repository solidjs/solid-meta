import {
  Component,
  createContext,
  createRenderEffect,
  createUniqueId,
  JSX,
  onCleanup,
  ParentComponent,
  sharedConfig,
  useContext
} from "solid-js";
import { isServer, spread, escape } from "solid-js/web";

export const MetaContext = createContext<MetaContextType>();

interface TagDescription {
  tag: string;
  props: Record<string, unknown>;
  setting?: { close?: boolean; escape?: boolean };
  id: string;
  name?: string;
  ref?: Element;
}

export interface MetaContextType {
  addClientTag: (tag: TagDescription) => number;

  removeClientTag: (tag: TagDescription, index: number) => void;

  addServerTag?: (tagDesc: TagDescription) => void;
}

const cascadingTags = ["title", "meta"];

// https://html.spec.whatwg.org/multipage/semantics.html#the-title-element
const titleTagProperties: string[] = [];

const metaTagProperties: string[] =
  // https://html.spec.whatwg.org/multipage/semantics.html#the-meta-element
  ["name", "http-equiv", "content", "charset", "media"]
    // additional properties
    .concat(["property"]);

const getTagKey = (tag: TagDescription, properties: string[]) => {
  // pick allowed properties and sort them
  const tagProps = Object.fromEntries(
    Object.entries(tag.props)
      .filter(([k]) => properties.includes(k))
      .sort()
  );

  // treat `property` as `name` for meta tags
  if (Object.hasOwn(tagProps, "name") || Object.hasOwn(tagProps, "property")) {
    tagProps.name = tagProps.name || tagProps.property;
    delete tagProps.property;
  }

  // concat tag name and properties as unique key for this tag
  return tag.tag + JSON.stringify(tagProps);
};

const MetaProvider: ParentComponent<{ tags?: Array<TagDescription> }> = props => {
  if (!isServer && !sharedConfig.context) {
    const ssrTags = document.head.querySelectorAll(`[data-sm]`);
    // `forEach` on `NodeList` is not supported in Googlebot, so use a workaround
    Array.prototype.forEach.call(ssrTags, (ssrTag: Node) => ssrTag.parentNode!.removeChild(ssrTag));
  }
  const cascadedTagInstances = new Map();

  // TODO: use one element for all tags of the same type, just swap out
  // where the props get applied
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
      if (cascadingTags.indexOf(tag.tag) !== -1) {
        const properties = tag.tag === "title" ? titleTagProperties : metaTagProperties;
        const tagKey = getTagKey(tag, properties);

        //  only cascading tags need to be kept as singletons
        if (!cascadedTagInstances.has(tagKey)) {
          cascadedTagInstances.set(tagKey, []);
        }

        let instances = cascadedTagInstances.get(tagKey);
        let index = instances.length;

        instances = [...instances, tag];

        // track indices synchronously
        cascadedTagInstances.set(tagKey, instances);

        if (!isServer) {
          let element = getElement(tag);
          tag.ref = element;

          spread(element, tag.props);

          let lastVisited = null;
          for (var i = index - 1; i >= 0; i--) {
            if (instances[i] != null) {
              lastVisited = instances[i];
              break;
            }
          }

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

        spread(element, tag.props);

        if (element.parentNode != document.head) {
          document.head.appendChild(element);
        }
      }

      return -1;
    },

    removeClientTag: (tag: TagDescription, index: number) => {
      const properties = tag.tag === "title" ? titleTagProperties : metaTagProperties;
      const tagKey = getTagKey(tag, properties);

      if (tag.ref) {
        const t = cascadedTagInstances.get(tagKey);
        if (t) {
          if (tag.ref.parentNode) {
            tag.ref.parentNode.removeChild(tag.ref);
            for (let i = index - 1; i >= 0; i--) {
              if (t[i] != null) {
                document.head.appendChild(t[i].ref);
              }
            }
          }

          t[index] = null;
          cascadedTagInstances.set(tagKey, t);
        } else {
          if (tag.ref.parentNode) {
            tag.ref.parentNode.removeChild(tag.ref);
          }
        }
      }
    }
  };

  if (isServer) {
    actions.addServerTag = (tagDesc: TagDescription) => {
      const { tags = [] } = props;
      // tweak only cascading tags
      if (cascadingTags.indexOf(tagDesc.tag) !== -1) {
        const properties = tagDesc.tag === "title" ? titleTagProperties : metaTagProperties;
        const tagDescKey = getTagKey(tagDesc, properties);
        const index = tags.findIndex(
          prev => prev.tag === tagDesc.tag && getTagKey(prev, properties) === tagDescKey
        );
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

const MetaTag = (
  tag: string,
  props: { [k: string]: any },
  setting?: { escape?: boolean; close?: boolean }
) => {
  const id = createUniqueId();
  const c = useContext(MetaContext);
  if (!c) throw new Error("<MetaProvider /> should be in the tree");

  useHead({
    tag,
    props,
    setting,
    id,
    get name() {
      return props.name || props.property;
    }
  });

  return null;
};

export { MetaProvider };

export function useHead(tagDesc: TagDescription) {
  const { addClientTag, removeClientTag, addServerTag } = useContext(MetaContext)!;

  createRenderEffect(() => {
    if (!isServer) {
      let index = addClientTag(tagDesc);
      onCleanup(() => removeClientTag(tagDesc, index));
    }
  });

  if (isServer) {
    addServerTag!(tagDesc);
    return null;
  }
}

export function renderTags(tags: Array<TagDescription>) {
  return tags
    .map(tag => {
      const keys = Object.keys(tag.props);
      const props = keys
        .map(k =>
          k === "children"
            ? ""
            : ` ${k}="${
                // @ts-expect-error
                escape(tag.props[k], true)
              }"`
        )
        .join("");
      const children = tag.props.children;
      if (tag.setting?.close) {
        return `<${tag.tag} data-sm="${tag.id}"${props}>${
          // @ts-expect-error
          tag.setting?.escape ? escape(children) : children || ""
        }</${tag.tag}>`;
      }
      return `<${tag.tag} data-sm="${tag.id}"${props}/>`;
    })
    .join("");
}

export const Title: Component<JSX.HTMLAttributes<HTMLTitleElement>> = props =>
  MetaTag("title", props, { escape: true, close: true });

export const Style: Component<JSX.StyleHTMLAttributes<HTMLStyleElement>> = props =>
  MetaTag("style", props, { close: true });

export const Meta: Component<JSX.MetaHTMLAttributes<HTMLMetaElement>> = props =>
  MetaTag("meta", props);

export const Link: Component<JSX.LinkHTMLAttributes<HTMLLinkElement>> = props =>
  MetaTag("link", props);

export const Base: Component<JSX.BaseHTMLAttributes<HTMLBaseElement>> = props =>
  MetaTag("base", props);

export const Stylesheet: Component<
  Omit<JSX.LinkHTMLAttributes<HTMLLinkElement>, "rel">
> = props => <Link rel="stylesheet" {...props} />;
