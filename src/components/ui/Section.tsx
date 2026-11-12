"use client";

import type { ReactNode } from "react";
import {
  Body1,
  Subtitle1,
  makeStyles,
  tokens,
} from "@fluentui/react-components";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
    paddingBlock: tokens.spacingVerticalXXL,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  header: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  description: { color: tokens.colorNeutralForeground3 },
});

type SectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

/** Titled page section with consistent vertical rhythm. */
export function Section({ title, description, children }: SectionProps) {
  const s = useStyles();
  return (
    <section className={s.root}>
      <div className={s.header}>
        <Subtitle1 as="h2">{title}</Subtitle1>
        {description && <Body1 className={s.description}>{description}</Body1>}
      </div>
      {children}
    </section>
  );
}
