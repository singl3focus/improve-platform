export type AppLanguage = "ru" | "en";
export type AppTheme = "light" | "dark";

export interface AuthCopy {
  loginTitle: string;
  registerTitle: string;
  loginSubmit: string;
  registerSubmit: string;
  helperNoAccount: string;
  helperCreateOne: string;
  helperAlreadyHasAccount: string;
  helperSignIn: string;
  fullNameLabel: string;
  emailLabel: string;
  passwordLabel: string;
  processingLabel: string;
  fallbackError: string;
}

export interface NavigationCopy {
  brand: string;
  ariaPrimary: string;
  appLabel: string;
  todayLabel: string;
  dashboardLabel: string;
  roadmapLabel: string;
  tasksLabel: string;
  materialsLabel: string;
  settingsLabel: string;
  signOut: string;
  signingOut: string;
}

export interface ProfileCopy {
  title: string;
  memberSince: string;
  editNameTitle: string;
  fullNameLabel: string;
  saveNameButton: string;
  changeEmailTitle: string;
  newEmailLabel: string;
  changePasswordTitle: string;
  currentPasswordLabel: string;
  newPasswordLabel: string;
  saveButton: string;
  saving: string;
  successMessage: string;
  errorWrongPassword: string;
  errorEmailExists: string;
  errorFallback: string;
}

export interface SettingsCopy {
  title: string;
  description: string;
  languageLabel: string;
  themeLabel: string;
  languageRu: string;
  languageEn: string;
  themeLight: string;
  themeDark: string;
  applyNote: string;
}

export interface DashboardCopy {
  requestFailed: (status: number) => string;
  blockLoadFailed: string;
  retry: string;
  open: string;
  panelAriaLabel: (title: string) => string;
  loading: string;
  noDate: string;
  greetingWithName: (name: string) => string;
  greetingDefault: string;
  today: (date: string) => string;
  snapshotTitle: string;
  dailySummaryLoadFailed: string;
  dailySummaryEmpty: string;
  upcomingTasksMetric: (count: number) => string;
  roadmapProgressTitle: string;
  roadmapProgressLoadFailed: string;
  roadmapProgressLoading: string;
  roadmapProgressEmpty: string;
  roadmapProgressLabel: (percent: number, completed: number, total: number) => string;
  topicsInProgressTitle: string;
  topicsInProgressDescription: string;
  topicsInProgressLoadFailed: string;
  topicsInProgressEmpty: string;
  targetDate: (date: string) => string;
  recentMaterialsTitle: string;
  recentMaterialsDescription: string;
  recentMaterialsLoadFailed: string;
  recentMaterialsEmpty: string;
  openedAt: (topic: string, value: string) => string;
  historyTitle: string;
  historyDescription: string;
  historyLoadFailed: string;
  historyEmpty: string;
  historyDetailsTitle: string;
  historyDetailsDescription: string;
  historyViewAll: string;
  upcomingTasksTitle: string;
  upcomingTasksDescription: string;
  upcomingTasksLoadFailed: string;
  upcomingTasksEmpty: string;
  noTopic: string;
  dueAt: (topic: string, value: string) => string;
  overdue: string;
  planned: string;
  chartsTitle: string;
  chartsDescription: string;
  chartsLoadFailed: string;
  chartsEmpty: string;
  chartTopicsByStatusTitle: string;
  chartDeadlinesTitle: string;
  chartStatusNotStarted: string;
  chartStatusInProgress: string;
  chartStatusPaused: string;
  chartStatusCompleted: string;
  chartDeadlinesDayLabel: (date: string) => string;
  chartCountLabel: (count: number) => string;
  confidencePromptTitle: string;
  confidenceSkip: string;
  confidenceLabels: string[];
  // Feature 1: Daily Focus
  focusToday: string;
  focusPriorityOverdue: string;
  focusPriorityToday: string;
  focusPriorityActive: string;
  focusAlsoToday: string;
  focusContinue: string;
  focusMarkDone: string;
  focusEmptyState: string;
  focusNoDue: string;
  // Feature 5: Weekly Review
  weeklyReviewTitle: string;
  weeklyReviewStep1: string;
  weeklyReviewStep2: string;
  weeklyReviewStep3: string;
  weeklyReviewReflection: string;
  weeklyReviewNextGoal: string;
  weeklyReviewComplete: string;
  weeklyReviewNothingStuck: string;
  weeklyReviewCTA: string;
  weeklyReviewLastDone: (n: number) => string;
  // Feature 4: Multiple Roadmaps
  roadmapSwitcherLabel: string;
  newRoadmapPlaceholder: string;
  deleteRoadmapConfirm: string;
  roadmapProgressMultiple: string;
}

export interface AppCopy {
  auth: AuthCopy;
  navigation: NavigationCopy;
  settings: SettingsCopy;
  profile: ProfileCopy;
  dashboard: DashboardCopy;
}

const RU_COPY: AppCopy = {
  auth: {
    loginTitle: "Вход",
    registerTitle: "Создать аккаунт",
    loginSubmit: "Войти",
    registerSubmit: "Создать аккаунт",
    helperNoAccount: "Ещё нет аккаунта?",
    helperCreateOne: "Создать",
    helperAlreadyHasAccount: "Уже есть аккаунт?",
    helperSignIn: "Войти",
    fullNameLabel: "Полное имя",
    emailLabel: "Email",
    passwordLabel: "Пароль",
    processingLabel: "Обработка...",
    fallbackError: "Неожиданная ошибка авторизации. Попробуйте ещё раз."
  },
  navigation: {
    brand: "Improve Platform",
    ariaPrimary: "Основная навигация",
    appLabel: "Приложение",
    todayLabel: "Сегодня",
    dashboardLabel: "Дашборд",
    roadmapLabel: "Дорожная карта",
    tasksLabel: "Задачи",
    materialsLabel: "Материалы",
    settingsLabel: "Настройки",
    signOut: "Выйти",
    signingOut: "Выход..."
  },
  settings: {
    title: "Настройки",
    description: "Управляйте языком интерфейса и темой отображения.",
    languageLabel: "Язык",
    themeLabel: "Тема",
    languageRu: "Русский",
    languageEn: "Английский",
    themeLight: "Светлая",
    themeDark: "Тёмная",
    applyNote: "Изменения применяются сразу и сохраняются после перезагрузки."
  },
  profile: {
    title: "Профиль",
    memberSince: "Участник с",
    editNameTitle: "Имя",
    fullNameLabel: "Полное имя",
    saveNameButton: "Сохранить имя",
    changeEmailTitle: "Email",
    newEmailLabel: "Новый email",
    changePasswordTitle: "Пароль",
    currentPasswordLabel: "Текущий пароль",
    newPasswordLabel: "Новый пароль",
    saveButton: "Сохранить",
    saving: "Сохранение...",
    successMessage: "Изменения сохранены",
    errorWrongPassword: "Неверный текущий пароль",
    errorEmailExists: "Этот email уже занят",
    errorFallback: "Не удалось сохранить изменения"
  },
  dashboard: {
    requestFailed: (status) => `Ошибка запроса (${status})`,
    blockLoadFailed: "Не удалось загрузить блок дашборда.",
    retry: "Повторить",
    open: "Открыть",
    panelAriaLabel: (title) => `${title}. Открыть детали.`,
    loading: "Загрузка...",
    noDate: "Нет даты",
    greetingWithName: (name) => `Привет, ${name}`,
    greetingDefault: "Привет!",
    today: (date) => `Сегодня ${date}`,
    snapshotTitle: "Срез обучения на сегодня",
    dailySummaryLoadFailed: "Не удалось загрузить ежедневную сводку.",
    dailySummaryEmpty: "Нет ближайших задач. Создайте задачу с дедлайном, чтобы видеть сводку.",
    upcomingTasksMetric: (count) => `Скоро задач: ${count}`,
    roadmapProgressTitle: "Прогресс roadmap",
    roadmapProgressLoadFailed: "Не удалось загрузить прогресс roadmap.",
    roadmapProgressLoading: "Загрузка...",
    roadmapProgressEmpty: "Прогресс пуст. Начните первую тему.",
    roadmapProgressLabel: (percent, completed, total) =>
      `${percent}% выполнено (${completed}/${total} тем)`,
    topicsInProgressTitle: "Темы в работе",
    topicsInProgressDescription: "То, что вы активно двигаете на этой неделе.",
    topicsInProgressLoadFailed: "Не удалось загрузить темы в работе.",
    topicsInProgressEmpty: "Пока нет активных тем.",
    targetDate: (date) => `Целевая дата: ${date}`,
    recentMaterialsTitle: "Недавние материалы",
    recentMaterialsDescription: "Ресурсы, к которым вы недавно возвращались.",
    recentMaterialsLoadFailed: "Не удалось загрузить материалы.",
    recentMaterialsEmpty: "Пока нет недавних материалов.",
    openedAt: (topic, value) => `${topic} · открыто ${value}`,
    historyTitle: "История",
    historyDescription: "Последние действия по задачам, темам и материалам.",
    historyLoadFailed: "Не удалось загрузить историю.",
    historyEmpty: "История пока пуста.",
    historyDetailsTitle: "Подробная история",
    historyDetailsDescription: "Лента последних событий в вашем обучении.",
    historyViewAll: "Вся история",
    upcomingTasksTitle: "Ближайшие задачи",
    upcomingTasksDescription: "Что нужно сделать в ближайшее время.",
    upcomingTasksLoadFailed: "Не удалось загрузить задачи.",
    upcomingTasksEmpty: "Нет ближайших задач.",
    noTopic: "Без темы",
    dueAt: (topic, value) => `${topic} · срок ${value}`,
    overdue: "Просрочено",
    planned: "Запланировано",
    chartsTitle: "Графики обучения",
    chartsDescription: "Краткая аналитика по темам и дедлайнам на ближайшую неделю.",
    chartsLoadFailed: "Не удалось загрузить блок графиков.",
    chartsEmpty: "Пока нет данных для графиков.",
    chartTopicsByStatusTitle: "Темы по статусам",
    chartDeadlinesTitle: "Дедлайны на 7 дней",
    chartStatusNotStarted: "Не начато",
    chartStatusInProgress: "В работе",
    chartStatusPaused: "На паузе",
    chartStatusCompleted: "Завершено",
    chartDeadlinesDayLabel: (date) => date,
    chartCountLabel: (count) => `${count}`,
    confidencePromptTitle: "Насколько уверенно вы освоили тему?",
    confidenceSkip: "Пропустить",
    confidenceLabels: ["Поверхностно", "Знаю основы", "Понимаю", "Уверенно", "Могу объяснить"],
    focusToday: "Фокус на сегодня",
    focusPriorityOverdue: "ПРОСРОЧЕНО",
    focusPriorityToday: "СЕГОДНЯ",
    focusPriorityActive: "В РАБОТЕ",
    focusAlsoToday: "Ещё на сегодня:",
    focusContinue: "Продолжить с места остановки",
    focusMarkDone: "Готово",
    focusEmptyState: "На сегодня ничего не запланировано. Добавьте задачу с дедлайном.",
    focusNoDue: "Без дедлайна",
    weeklyReviewTitle: "Обзор недели",
    weeklyReviewStep1: "Что произошло",
    weeklyReviewStep2: "Что застряло",
    weeklyReviewStep3: "План на следующую неделю",
    weeklyReviewReflection: "Ваши мысли (необязательно)",
    weeklyReviewNextGoal: "Главная цель на следующую неделю:",
    weeklyReviewComplete: "Завершить обзор",
    weeklyReviewNothingStuck: "Ничего не застряло — отличная неделя!",
    weeklyReviewCTA: "Обзор недели →",
    weeklyReviewLastDone: (n) => `Последний обзор: ${n} дн. назад`,
    roadmapSwitcherLabel: "Дорожная карта",
    newRoadmapPlaceholder: "Название новой дорожной карты",
    deleteRoadmapConfirm: "Удалить дорожную карту и все её темы?",
    roadmapProgressMultiple: "Прогресс по дорожным картам"
  }
};

const EN_COPY: AppCopy = {
  auth: {
    loginTitle: "Sign in",
    registerTitle: "Create account",
    loginSubmit: "Sign in",
    registerSubmit: "Create account",
    helperNoAccount: "No account yet?",
    helperCreateOne: "Create one",
    helperAlreadyHasAccount: "Already have an account?",
    helperSignIn: "Sign in",
    fullNameLabel: "Full name",
    emailLabel: "Email",
    passwordLabel: "Password",
    processingLabel: "Processing...",
    fallbackError: "Unexpected auth error. Please try again."
  },
  navigation: {
    brand: "Improve Platform",
    ariaPrimary: "Primary navigation",
    appLabel: "App",
    todayLabel: "Today",
    dashboardLabel: "Dashboard",
    roadmapLabel: "Roadmap",
    tasksLabel: "Tasks",
    materialsLabel: "Materials",
    settingsLabel: "Settings",
    signOut: "Sign out",
    signingOut: "Signing out..."
  },
  settings: {
    title: "Settings",
    description: "Manage interface language and display theme.",
    languageLabel: "Language",
    themeLabel: "Theme",
    languageRu: "Russian",
    languageEn: "English",
    themeLight: "Light",
    themeDark: "Dark",
    applyNote: "Changes are applied instantly and saved after reload."
  },
  profile: {
    title: "Profile",
    memberSince: "Member since",
    editNameTitle: "Name",
    fullNameLabel: "Full name",
    saveNameButton: "Save name",
    changeEmailTitle: "Email",
    newEmailLabel: "New email",
    changePasswordTitle: "Password",
    currentPasswordLabel: "Current password",
    newPasswordLabel: "New password",
    saveButton: "Save",
    saving: "Saving...",
    successMessage: "Changes saved",
    errorWrongPassword: "Current password is incorrect",
    errorEmailExists: "This email is already taken",
    errorFallback: "Failed to save changes"
  },
  dashboard: {
    requestFailed: (status) => `Request failed (${status})`,
    blockLoadFailed: "Dashboard block failed to load.",
    retry: "Retry",
    open: "Open",
    panelAriaLabel: (title) => `${title}. Open details.`,
    loading: "Loading...",
    noDate: "No date",
    greetingWithName: (name) => `Hi, ${name}`,
    greetingDefault: "Hi!",
    today: (date) => `Today ${date}`,
    snapshotTitle: "Today learning snapshot",
    dailySummaryLoadFailed: "Daily summary failed to load.",
    dailySummaryEmpty: "No upcoming tasks. Create a task with a deadline to see your snapshot.",
    upcomingTasksMetric: (count) => `${count} upcoming tasks`,
    roadmapProgressTitle: "Roadmap progress",
    roadmapProgressLoadFailed: "Progress failed to load.",
    roadmapProgressLoading: "Loading...",
    roadmapProgressEmpty: "Roadmap progress is empty. Start your first topic to see progress.",
    roadmapProgressLabel: (percent, completed, total) =>
      `${percent}% complete (${completed}/${total} topics)`,
    topicsInProgressTitle: "Topics in progress",
    topicsInProgressDescription: "Where you are actively moving this week.",
    topicsInProgressLoadFailed: "Topics failed to load.",
    topicsInProgressEmpty: "No active topics yet.",
    targetDate: (date) => `Target date: ${date}`,
    recentMaterialsTitle: "Recent materials",
    recentMaterialsDescription: "Resources you returned to recently.",
    recentMaterialsLoadFailed: "Materials failed to load.",
    recentMaterialsEmpty: "No recent materials yet.",
    openedAt: (topic, value) => `${topic} · opened ${value}`,
    historyTitle: "History",
    historyDescription: "Recent actions for tasks, topics, and materials.",
    historyLoadFailed: "History failed to load.",
    historyEmpty: "History is empty for now.",
    historyDetailsTitle: "History details",
    historyDetailsDescription: "Timeline of your latest learning events.",
    historyViewAll: "View all",
    upcomingTasksTitle: "Upcoming tasks",
    upcomingTasksDescription: "What should be done soon.",
    upcomingTasksLoadFailed: "Tasks failed to load.",
    upcomingTasksEmpty: "No upcoming tasks.",
    noTopic: "No topic",
    dueAt: (topic, value) => `${topic} · due ${value}`,
    overdue: "Overdue",
    planned: "Planned",
    chartsTitle: "Learning charts",
    chartsDescription: "Quick analytics across topic statuses and near-term deadlines.",
    chartsLoadFailed: "Charts block failed to load.",
    chartsEmpty: "No chart data yet.",
    chartTopicsByStatusTitle: "Topics by status",
    chartDeadlinesTitle: "Deadlines for 7 days",
    chartStatusNotStarted: "Not started",
    chartStatusInProgress: "In progress",
    chartStatusPaused: "Paused",
    chartStatusCompleted: "Completed",
    chartDeadlinesDayLabel: (date) => date,
    chartCountLabel: (count) => `${count}`,
    confidencePromptTitle: "How confident are you about this topic?",
    confidenceSkip: "Skip",
    confidenceLabels: ["Scratched surface", "Know basics", "Understand", "Confident", "Can teach"],
    focusToday: "Focus today",
    focusPriorityOverdue: "OVERDUE",
    focusPriorityToday: "TODAY",
    focusPriorityActive: "IN PROGRESS",
    focusAlsoToday: "Also today:",
    focusContinue: "Continue where you stopped",
    focusMarkDone: "Mark done",
    focusEmptyState: "Nothing scheduled for today. Add a task with a deadline.",
    focusNoDue: "No deadline",
    weeklyReviewTitle: "Week in Review",
    weeklyReviewStep1: "What happened",
    weeklyReviewStep2: "What got stuck",
    weeklyReviewStep3: "Next week plan",
    weeklyReviewReflection: "Your reflection (optional)",
    weeklyReviewNextGoal: "Main goal for next week:",
    weeklyReviewComplete: "Complete Review",
    weeklyReviewNothingStuck: "Nothing stuck — great week!",
    weeklyReviewCTA: "Weekly Review →",
    weeklyReviewLastDone: (n) => `Last review: ${n} day(s) ago`,
    roadmapSwitcherLabel: "Roadmap",
    newRoadmapPlaceholder: "New roadmap title",
    deleteRoadmapConfirm: "Delete roadmap and all its topics?",
    roadmapProgressMultiple: "Roadmap progress"
  }
};

export function getAppCopy(language: AppLanguage): AppCopy {
  if (language === "ru") {
    return RU_COPY;
  }
  return EN_COPY;
}

