import { Button } from "./button";
import styles from "./tabs.module.css";

export interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className={styles.root} role="tablist">
      {tabs.map((tab) => (
        <Button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === active}
          className={`${styles.tab} ${tab.id === active ? styles.active : ""}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </Button>
      ))}
    </div>
  );
}
