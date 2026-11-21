import { Badge, Card, Container } from "@/components/ui";
import { backend } from "@/lib/api/backend";
import { t } from "@/lib/messages";
import styles from "./BackendStatus.module.scss";

// Shows that frontend → platform-backend calls work after a deploy. Fetched on the server.
export async function BackendStatus() {
	const [health, ping] = await Promise.all([backend.health(), backend.ping()]);

	const healthy = health.ok && health.data.db;

	return (
		<Container className={styles.page}>
			<h1>{t("backendStatus.title")}</h1>
			<p className={styles.lead}>{t("backendStatus.lead")}</p>
			<div className={styles.grid}>
				<Card data-testid="health">
					<div className={styles.head}>
						<h2 className={styles.cardTitle}>{t("backendStatus.health")}</h2>
						<Badge tone={healthy ? "success" : "danger"}>{t(healthy ? "backendStatus.ok" : "backendStatus.down")}</Badge>
					</div>
					{health.ok ? (
						<dl className={styles.details}>
							<dt>{t("backendStatus.database")}</dt>
							<dd>{t(health.data.db ? "backendStatus.connected" : "backendStatus.disconnected")}</dd>
						</dl>
					) : (
						<p className={styles.error} role="alert">
							{t("backendStatus.unreachable")}
						</p>
					)}
				</Card>
				<Card data-testid="ping">
					<div className={styles.head}>
						<h2 className={styles.cardTitle}>{t("backendStatus.ping")}</h2>
						<Badge tone={ping.ok ? "success" : "danger"}>{t(ping.ok ? "backendStatus.ok" : "backendStatus.down")}</Badge>
					</div>
					{ping.ok ? (
						<dl className={styles.details}>
							<dt>{t("backendStatus.message")}</dt>
							<dd>{ping.data.message}</dd>
							<dt>{t("backendStatus.time")}</dt>
							<dd>{ping.data.time}</dd>
						</dl>
					) : (
						<p className={styles.error} role="alert">
							{t("backendStatus.unreachable")}
						</p>
					)}
				</Card>
			</div>
		</Container>
	);
}
