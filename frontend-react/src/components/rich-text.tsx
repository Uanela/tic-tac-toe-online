import { Fragment, type ReactNode } from "react";
import { Link } from "./link";
import type { MessagePart } from "../paraglide/runtime.js";

type TagPart = Exclude<MessagePart, { type: "text" }>;

/** Renders a translated message's markup in place, so word order survives translation; `{#a}` becomes a router `<Link>`, not an `<a>`, to keep navigation client-side. */
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
