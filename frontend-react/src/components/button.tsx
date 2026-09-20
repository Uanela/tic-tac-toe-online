import type { ComponentPropsWithRef, MouseEvent } from "react";
import { useSound } from "../utils/contexts/sound.context";

export function Button({
  onClick,
  ...rest
}: ComponentPropsWithRef<"button">) {
  const { play } = useSound();

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    play("makeMove");
    onClick?.(event);
  }

  return <button { ...rest } onClick={ handleClick } />;
}
