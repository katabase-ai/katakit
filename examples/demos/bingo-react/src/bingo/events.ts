import { KatakitEvent } from "@katakit/core";

export type GameStartedBingoEvent = KatakitEvent<{
  type: "gameStarted";
  cards: string[];
}>;

export type SquareManuallyChangedBingoEvent = KatakitEvent<{
  type: "squareManuallyChanged";
  index: number;
  marked: boolean;
}>;

export type SquareSpokenBingoEvent = KatakitEvent<{
  type: "squareSpoken";
  index: number;
}>;

export type BingoEvent =
  | GameStartedBingoEvent
  | SquareManuallyChangedBingoEvent
  | SquareSpokenBingoEvent;
