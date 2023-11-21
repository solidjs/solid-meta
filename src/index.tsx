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
import { isServer, spread, escape, useAssets, getRequestEvent, ssr } from "solid-js/web";

export const MetaContext = createContext<MetaContextType>();

declare module "solid-js/web" {
  interface RequestEvent {
    solidMeta?: MetaContextType;
  }
}

interface TagDescription {
  key?: string;
  tag: string;
  props: Record<string, unknown>;
  setting?: { close?: boolean; escape?: boolean };
  id: string;
  name?: string;
  ref?: Element;
}

export interface MetaContextType {
  addTag: (tag: TagDescription) => number;
  removeTag: (tag: TagDescription, index: number) => void;
}

const cascadingTags = ["title", "meta"];

const getTagKey = ({ tag, key }: TagDescription) => {
  if (tag === "title") return tag;
  if (tag === "meta" && key) return tag + "|" + key;
  return false;
};

function initClientProvider() {
  if (!sharedConfig.context) {
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

  return {
    addTag(tag: TagDescription) {
      if (cascadingTags.indexOf(tag.tag) !== -1) {
        const tagKey = getTagKey(tag);
        if (!tagKey) return -1;

        //  only cascading tags need to be kept as singletons
        if (!cascadedTagInstances.has(tagKey)) {
          cascadedTagInstances.set(tagKey, []);
        }

        let instances = cascadedTagInstances.get(tagKey);
        let index = instances.length;

        instances = [...instances, tag];

        // track indices synchronously
        cascadedTagInstances.set(tagKey, instances);

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

        return index;
      }

      let element = getElement(tag);
      tag.ref = element;

      spread(element, tag.props);

      if (element.parentNode != document.head) {
        document.head.appendChild(element);
      }

      return -1;
    },
    removeTag(tag: TagDescription, index: number) {
      const tagKey = getTagKey(tag);

      if (tag.ref) {
        const t = tagKey && cascadedTagInstances.get(tagKey);
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
}

function initServerProvider() {
  const tags: Array<TagDescription> = [];
  useAssets(() => ssr(renderTags(tags)) as any);

  return {
    addTag(tagDesc: TagDescription) {
      // tweak only cascading tags
      if (cascadingTags.indexOf(tagDesc.tag) !== -1) {
        const tagDescKey = getTagKey(tagDesc);
        const index = tags.findIndex(prev => {
          if (!tagDescKey) return false;
          const prevKey = getTagKey(prev);
          if (!prevKey) return false;
          return prev.tag === tagDesc.tag && prevKey === tagDescKey;
        });
        if (index !== -1) {
          tags.splice(index, 1);
        }
      }
      tags.push(tagDesc);
      return tags.length;
    },
    removeTag(tag: TagDescription, index: number) {}
  };
}

export const MetaProvider: ParentComponent = props => {
  let e;
  const actions: MetaContextType | undefined = !isServer
    ? initClientProvider()
    : (e = getRequestEvent())
    ? e.solidMeta || (e.solidMeta = initServerProvider())
    : initServerProvider();
  return <MetaContext.Provider value={actions!}>{props.children}</MetaContext.Provider>;
};

const MetaTag = (
  tag: string,
  props: { [k: string]: any },
  setting?: { escape?: boolean; close?: boolean }
) => {
  useHead({
    tag,
    props,
    setting,
    id: createUniqueId(),
    get name() {
      return props.name || props.property;
    }
  });

  return null;
};

export function useHead(tagDesc: TagDescription) {
  let c: MetaContextType | undefined;
  if (isServer) {
    const event = getRequestEvent();
    c = event && event.solidMeta;
    // TODO: Consider if we want to support tags above MetaProvider
    // if (event) {
    //   c = event.solidMeta || (event.solidMeta = initServerProvider());
    // }
  }
  c = c || useContext(MetaContext);
  if (!c) throw new Error("<MetaProvider /> should be in the tree");

  createRenderEffect(() => {
    const index = c!.addTag(tagDesc);
    onCleanup(() => c!.removeTag(tagDesc, index));
  });
}

function renderTags(tags: Array<TagDescription>) {
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

type KeyProp = {
  /**
   * If set, this element will override previous meta elements with the same `key` value.
   * */
  key?: string;
};

export const Title: Component<JSX.HTMLAttributes<HTMLTitleElement>> = props =>
  MetaTag("title", props, { escape: true, close: true });

export const Style: Component<JSX.StyleHTMLAttributes<HTMLStyleElement>> = props =>
  MetaTag("style", props, { close: true });

export const Meta: Component<JSX.MetaHTMLAttributes<HTMLMetaElement> & KeyProp> = props =>
  MetaTag("meta", props);

export const Link: Component<JSX.LinkHTMLAttributes<HTMLLinkElement>> = props =>
  MetaTag("link", props);

export const Base: Component<JSX.BaseHTMLAttributes<HTMLBaseElement>> = props =>
  MetaTag("base", props);

export const Stylesheet: Component<
  Omit<JSX.LinkHTMLAttributes<HTMLLinkElement>, "rel">
> = props => <Link rel="stylesheet" {...props} />;
