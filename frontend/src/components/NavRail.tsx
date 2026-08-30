import styles from "./NavRail.module.css";

export type View = "tasks" | "calendar";

interface Props {
  active: View;
  onSelect: (view: View) => void;
}

export default function NavRail({ active, onSelect }: Props) {
  return (
    <nav className={styles.rail}>
      <button
        type="button"
        className={active === "tasks" ? styles.active : undefined}
        onClick={() => onSelect("tasks")}
      >
        <span className={styles.icon}>✓</span>
        <span className={styles.label}>Tasks</span>
      </button>
      <button
        type="button"
        className={active === "calendar" ? styles.active : undefined}
        onClick={() => onSelect("calendar")}
      >
        <span className={styles.icon}>▦</span>
        <span className={styles.label}>Calendar</span>
      </button>
    </nav>
  );
}
