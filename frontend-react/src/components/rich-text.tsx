import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { MessagePart } from "../paraglide/runtime.js";

type TagPart = Exclude<MessagePart, { type: "text" }>;

/**
 * Renders the inline markup of a translated message, so a sentence keeps its
 * emphasis and its links wherever the target language happens to put them,
 * rather than being glued together from fragments that only fit one word order.
 *
 * `{#a}` becomes a router `<Link>`, not an `<a>`, so following a translated
 * link is still a client-side navigation.
 */
export function RichText({ parts }: { parts: MessagePart[] }) {
  const root: ReactNode[] = [];
  const stack: ReactNode[][] = [];

  for (const part of parts) {
    const siblings = stack[stack.length - 1] ?? root;

    if (part.type === "text") {
      siblings.push(part.value);
    } else if (part.type === "markup-start") {
      const children: ReactNode[] = [];
      siblings.push(tag(part, children, siblings.length));
      stack.push(children);
    } else if (part.type === "markup-end") {
      stack.pop();
    } else {
      siblings.push(tag(part, [], siblings.length));
    }
  }

  return <>{root}</>;
}

function tag(part: TagPart, children: ReactNode[], key: number) {
  if (part.name === "strong") {
    return <strong key={key}>{children}</strong>;
  }

  if (part.name === "a") {
    const href = part.attributes.href;
    return (
      <Link key={key} to={typeof href === "string" ? href : "/"}>
        {children}
      </Link>
    );
  }

  return <Fragment key={key}>{children}</Fragment>;
}
