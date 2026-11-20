import clsx from "clsx";
import type { ReactNode } from "react";
import { EmptyState } from "../EmptyState/EmptyState";
import { Skeleton } from "../Skeleton/Skeleton";
import styles from "./Table.module.scss";

export interface Column<T> {
	key: string;
	header: string;
	render?: (row: T) => ReactNode;
	width?: string;
	align?: "left" | "right";
}

interface TableProps<T> {
	columns: Column<T>[];
	rows: T[];
	getRowKey: (row: T) => string;
	loading?: boolean;
	skeletonRows?: number;
	emptyTitle?: string;
	emptyDescription?: string;
}

// Server-component friendly (no state). Loading shows row-shaped skeletons; empty shows EmptyState.
export function Table<T>({ columns, rows, getRowKey, loading, skeletonRows = 5, emptyTitle = "Нічого не знайдено", emptyDescription }: TableProps<T>) {
	const cell = (row: T, column: Column<T>): ReactNode =>
		column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key] ?? "");

	return (
		<div className={styles.wrap}>
			<table className={styles.table}>
				<thead>
					<tr>
						{columns.map((column) => (
							<th key={column.key} scope="col" style={{ width: column.width }} className={clsx(column.align === "right" && styles.right)}>
								{column.header}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{loading
						? Array.from({ length: skeletonRows }, (_, i) => (
								<tr key={i}>
									{columns.map((column) => (
										<td key={column.key}>
											<Skeleton height="1.6rem" width="70%" />
										</td>
									))}
								</tr>
							))
						: rows.map((row) => (
								<tr key={getRowKey(row)}>
									{columns.map((column) => (
										<td key={column.key} className={clsx(column.align === "right" && styles.right)}>
											<span className={styles.cell}>{cell(row, column)}</span>
										</td>
									))}
								</tr>
							))}
				</tbody>
			</table>
			{!loading && rows.length === 0 && <EmptyState title={emptyTitle} description={emptyDescription} />}
		</div>
	);
}
