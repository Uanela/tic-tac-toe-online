import type { MouseEvent } from "react";
import { Link as RouterLink, type LinkProps } from "react-router-dom";
import { useSound } from "../utils/contexts/sound.context";

/**
 * The router's `Link` with the click the shared `Button` already makes. Moving
 * the player somewhere should sound the same whether it is a button or a link,
 * so navigation goes through here rather than the router's `Link` directly.
 */
export function Link({ onClick, ...rest }: LinkProps) {
  const { play } = useSound();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    play("makeMove");
    onClick?.(event);
  }

  return <RouterLink { ...rest } onClick={ handleClick } />;
}
