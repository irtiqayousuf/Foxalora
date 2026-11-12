"use client";

import type { ReactNode } from "react";
import {
  Body1,
  Card,
  CardFooter,
  CardHeader,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";

const useStyles = makeStyles({
  card: { height: "100%" },
  icon: {
    display: "grid",
    placeItems: "center",
    width: "40px",
    height: "40px",
    fontSize: "22px",
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground2,
  },
  body: { color: tokens.colorNeutralForeground2 },
});

type FeatureCardProps = {
  icon: ReactNode;
  title: string;
  description: string;
  footer?: ReactNode;
};

/** Card with an icon tile, title, description and optional actions. */
export function FeatureCard({ icon, title, description, footer }: FeatureCardProps) {
  const s = useStyles();
  return (
    <Card className={s.card}>
      <CardHeader
        image={<span className={s.icon}>{icon}</span>}
        header={<Text weight="semibold">{title}</Text>}
      />
      <Body1 className={s.body}>{description}</Body1>
      {footer && <CardFooter>{footer}</CardFooter>}
    </Card>
  );
}
