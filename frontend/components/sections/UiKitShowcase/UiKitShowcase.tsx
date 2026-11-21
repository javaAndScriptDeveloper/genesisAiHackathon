"use client";

import { useQuery } from "@tanstack/react-query";
import {
	Add01Icon,
	ArrowRight01Icon,
	Delete02Icon,
	Edit02Icon,
	MoreHorizontalIcon,
	Search01Icon,
	Settings02Icon,
	UserIcon,
} from "@hugeicons/core-free-icons";
import { useState, type ReactNode } from "react";
import { api, type Item } from "@/lib/api";
import { t } from "@/lib/messages";
import {
	Avatar,
	Badge,
	Button,
	Card,
	Carousel,
	Checkbox,
	Column,
	ConfirmDialog,
	Container,
	Dropdown,
	EmptyState,
	Icon,
	IconButton,
	Input,
	Modal,
	Pagination,
	Select,
	Skeleton,
	Switch,
	Table,
	Tabs,
	Textarea,
	Tooltip,
	useToast,
} from "@/components/ui";
import styles from "./UiKitShowcase.module.scss";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
	return (
		<section id={id} className={styles.section}>
			<h2 className={styles.sectionTitle}>{title}</h2>
			{children}
		</section>
	);
}

const SWATCHES = ["canvas", "surfaceMuted", "border", "textSubtle", "text", "accent", "accentSoft", "success", "warning", "danger"] as const;
const STATUS_TONE = { active: "success", draft: "warning", archived: "neutral" } as const;
const STATUS_LABEL = { active: "Активний", draft: "Чернетка", archived: "Архів" } as const;
const ICON_SAMPLES = [
	["Search01Icon", Search01Icon],
	["Add01Icon", Add01Icon],
	["Edit02Icon", Edit02Icon],
	["Delete02Icon", Delete02Icon],
	["Settings02Icon", Settings02Icon],
	["UserIcon", UserIcon],
] as const;

const columns: Column<Item>[] = [
	{ key: "title", header: "Назва" },
	{ key: "owner", header: "Власник" },
	{ key: "status", header: "Статус", render: (row) => <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge> },
	{ key: "createdAt", header: "Створено", render: (row) => new Date(row.createdAt).toLocaleDateString("uk-UA"), align: "right" },
];

export function UiKitShowcase() {
	const toast = useToast();
	const [select, setSelect] = useState<string | null>(null);
	const [modal, setModal] = useState(false);
	const [confirm, setConfirm] = useState(false);
	const [page, setPage] = useState(1);
	const PAGE_SIZE = 5;
	const list = useQuery({ queryKey: ["items", page], queryFn: () => api.listItems(page, PAGE_SIZE), placeholderData: (prev) => prev });

	return (
		<Container className={styles.page}>
			<header className={styles.hero}>
				<p className="eyebrow">Design system</p>
				<h1>{t("uiKit.title")}</h1>
				<p className="lead">{t("uiKit.lead")}</p>
			</header>

			<Section id="typography" title={t("uiKit.typography")}>
				<div className={styles.stack}>
					<h1>H1 Unbounded 800</h1>
					<h2>H2 Заголовок розділу</h2>
					<h3>H3 Підзаголовок</h3>
					<h4>H4 Малий заголовок</h4>
					<p className="lead">Lead — вступний абзац, трохи більший за основний текст.</p>
					<p>Body — основний текст Inter 16px. Мінімалізм без зайвого: простір, ритм і чітка ієрархія.</p>
					<p className="small">Small — допоміжний текст 14px.</p>
					<p className="caption">Caption — підпис 12px.</p>
					<p className="eyebrow">Eyebrow label</p>
					<p style={{ fontFamily: "var(--font-montserrat)" }}>Montserrat — альтернативний шрифт.</p>
					<p style={{ fontFamily: "var(--font-poppins)" }}>Poppins — альтернативний шрифт.</p>
				</div>
			</Section>

			<Section id="colors" title={t("uiKit.colors")}>
				<div className={styles.swatches}>
					{SWATCHES.map((name) => (
						<div key={name} className={styles.swatch}>
							<span className={styles.chip} style={{ background: `var(--color-${name})` }} />
							<span className="caption">--color-{name}</span>
						</div>
					))}
				</div>
			</Section>

			<Section id="buttons" title={t("uiKit.buttons")}>
				<div className={styles.row}>
					<Button>Primary</Button>
					<Button variant="secondary">Secondary</Button>
					<Button variant="ghost">Ghost</Button>
					<Button variant="danger">Danger</Button>
					<Button iconLeft={Add01Icon}>З іконкою</Button>
					<Button iconRight={ArrowRight01Icon} variant="secondary">Далі</Button>
					<Button loading>Loading</Button>
					<Button disabled>Disabled</Button>
				</div>
				<div className={styles.row}>
					<Button size="sm">Small</Button>
					<Button size="md">Medium</Button>
					<Button size="lg">Large</Button>
					<Tooltip text="Редагувати">
						<IconButton icon={Edit02Icon} label="Редагувати" variant="secondary" />
					</Tooltip>
				</div>
			</Section>

			<Section id="forms" title={t("uiKit.forms")}>
				<div className={styles.grid}>
					<Input label="Ім’я" placeholder="Олена" hint="Як до вас звертатись" />
					<Input label="Email" defaultValue="не-email" error="Невірний email" />
					<Select
						label="Статус"
						value={select}
						onChange={setSelect}
						options={[
							{ value: "active", label: "Активний" },
							{ value: "draft", label: "Чернетка" },
							{ value: "archived", label: "Архів" },
							{ value: "off", label: "Вимкнено", disabled: true },
						]}
					/>
					<Textarea label="Повідомлення" placeholder="Напишіть щось…" />
					<div className={styles.stack}>
						<Checkbox label="Погоджуюсь з умовами" />
						<Switch label="Сповіщення" defaultChecked />
					</div>
				</div>
			</Section>

			<Section id="overlays" title={t("uiKit.overlays")}>
				<div className={styles.row}>
					<Button variant="secondary" onClick={() => setModal(true)}>Відкрити модалку</Button>
					<Button variant="danger" onClick={() => setConfirm(true)}>Видалити…</Button>
					<Button variant="secondary" onClick={() => toast.show("Збережено", "success")}>Toast success</Button>
					<Button variant="secondary" onClick={() => toast.show("Щось пішло не так", "danger")}>Toast error</Button>
					<Dropdown
						trigger={(props) => <IconButton icon={MoreHorizontalIcon} label="Дії" variant="secondary" {...props} />}
						items={[
							{ label: "Редагувати", icon: Edit02Icon, onSelect: () => toast.show("Редагування") },
							{ label: "Видалити", icon: Delete02Icon, tone: "danger", onSelect: () => setConfirm(true) },
						]}
					/>
				</div>
				<Modal open={modal} onClose={() => setModal(false)} title="Нова задача" footer={<Button onClick={() => setModal(false)}>{t("common.save")}</Button>}>
					<Input label="Назва" placeholder="Фокус одразу тут" />
				</Modal>
				<ConfirmDialog
					open={confirm}
					tone="danger"
					title="Видалити елемент?"
					description="Цю дію не можна скасувати."
					confirmLabel={t("common.delete")}
					onCancel={() => setConfirm(false)}
					onConfirm={() => {
						setConfirm(false);
						toast.show("Видалено", "success");
					}}
				/>
			</Section>

			<Section id="data" title={t("uiKit.data")}>
				<div className={styles.stack}>
					<Table columns={columns} rows={list.data?.items ?? []} getRowKey={(row) => row.id} loading={list.isLoading} skeletonRows={PAGE_SIZE} />
					<Pagination page={page} pageCount={Math.ceil((list.data?.total ?? 0) / PAGE_SIZE)} onChange={setPage} />
				</div>
			</Section>

			<Section id="navigation" title={t("uiKit.navigation")}>
				<div className={styles.stack}>
					<Tabs
						tabs={[
							{ id: "one", label: "Огляд", content: <p>Вміст першого табу.</p> },
							{ id: "two", label: "Деталі", content: <p>Вміст другого табу.</p> },
							{ id: "three", label: "Історія", content: <p>Вміст третього табу.</p> },
						]}
					/>
					<Carousel
						label="Приклад каруселі"
						slides={[1, 2, 3, 4, 5].map((n) => (
							<Card key={n} className={styles.slide}>
								<h4>Слайд {n}</h4>
								<p className="small">Swiper з навігацією, пагінацією та клавіатурою.</p>
							</Card>
						))}
					/>
				</div>
			</Section>

			<Section id="feedback" title={t("uiKit.feedback")}>
				<div className={styles.grid}>
					<div className={styles.row}>
						<Badge>Neutral</Badge>
						<Badge tone="accent">Accent</Badge>
						<Badge tone="success">Success</Badge>
						<Badge tone="warning">Warning</Badge>
						<Badge tone="danger">Danger</Badge>
						<Avatar name="Олена Коваль" />
					</div>
					<Card className={styles.stack}>
						<Skeleton width="40%" height="2rem" />
						<Skeleton />
						<Skeleton width="80%" />
					</Card>
					<Card padded={false}>
						<EmptyState title="Поки порожньо" description="Тут з’являться елементи, коли ви їх створите." action={<Button size="sm" iconLeft={Add01Icon}>Створити</Button>} />
					</Card>
				</div>
			</Section>

			<Section id="icons" title={t("uiKit.icons")}>
				<div className={styles.row}>
					{ICON_SAMPLES.map(([name, icon]) => (
						<div key={name} className={styles.iconCell}>
							<Icon icon={icon} size={24} />
							<span className="caption">{name}</span>
						</div>
					))}
				</div>
			</Section>
		</Container>
	);
}
