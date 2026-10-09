export const SUPPORTED_LOCALES = Object.freeze(['zh', 'zh-TW', 'en', 'ja', 'ko']);

const TRADITIONAL_CHINESE_REGIONS = new Set(['tw', 'hk', 'mo']);

export const DICTIONARIES = Object.freeze({
  zh: Object.freeze({
    'app.name': 'Grove',
    'app.chineseName': '林间',
    'app.publisher': 'Fern',
    'menu.about': '关于 Grove',
    'menu.language': '语言',
    'menu.languageAuto': '跟随系统',
    'about.title': '关于 Grove',
    'about.body': 'Fern 的 HanaAgent 扩展套件：统一管理面板与可逐项启用的小功能模块。',
    'about.version': '版本',
    'about.author': '作者',
    back: '返回',
    details: '详情',
    'group.on': '已启用',
    'group.off': '可启用',
    'group.attention': '需处理',
    'group.planned': '规划中',
    'status.planned': '规划中',
    'status.off': '未启用',
    'status.starting': '启动中',
    'status.on': '运行中',
    'status.blocked': '权限不足',
    'status.failed': '出错了',
    'status.stopping': '停止中',
    'action.enable': '启用',
    'action.disable': '停用',
    'action.retry': '重试',
    'hint.blocked': '缺少所需权限，请在 Hana 的应用权限设置中允许后重试。',
    'empty.catalog': '还没有任何模块。',
    'error.generic': '出了点问题，请稍后再试。',
    'error.MIGRATION_FAILED': '模块数据格式迁移失败，已保留原有数据。请稍后重试。',
    'error.SCHEMA_NEWER': '该模块比已存数据格式旧，请更新模块后再试。',
    'module.session-stats.name': '向日葵',
    'module.session-stats.desc': '会话统计',
    'module.token-stats.name': '小苔藓',
    'module.token-stats.desc': 'Token 统计',
    'module.task-manager.name': '松鼠',
    'module.task-manager.desc': '事务管理',
  }),
  'zh-TW': Object.freeze({
    'app.name': 'Grove',
    'app.chineseName': '林間',
    'app.publisher': 'Fern',
    'menu.about': '關於 Grove',
    'menu.language': '語言',
    'menu.languageAuto': '跟隨系統',
    'about.title': '關於 Grove',
    'about.body': 'Fern 的 HanaAgent 擴充套件：統一管理面板，以及可逐一啟用的小功能模組。',
    'about.version': '版本',
    'about.author': '作者',
    back: '返回',
    details: '詳細資訊',
    'group.on': '已啟用',
    'group.off': '可啟用',
    'group.attention': '需處理',
    'group.planned': '規劃中',
    'status.planned': '規劃中',
    'status.off': '未啟用',
    'status.starting': '啟動中',
    'status.on': '執行中',
    'status.blocked': '權限不足',
    'status.failed': '發生錯誤',
    'status.stopping': '停止中',
    'action.enable': '啟用',
    'action.disable': '停用',
    'action.retry': '重試',
    'hint.blocked': '缺少所需權限，請在 Hana 的應用程式權限設定中允許後再試。',
    'empty.catalog': '目前還沒有任何模組。',
    'error.generic': '發生問題，請稍後再試。',
    'error.MIGRATION_FAILED': '模組資料格式遷移失敗，已保留原有資料。請稍後再試。',
    'error.SCHEMA_NEWER': '該模組比已存資料格式舊，請更新模組後再試。',
    'module.session-stats.name': '向日葵',
    'module.session-stats.desc': '會話統計',
    'module.token-stats.name': '小苔蘚',
    'module.token-stats.desc': 'Token 統計',
    'module.task-manager.name': '松鼠',
    'module.task-manager.desc': '事務管理',
  }),
  en: Object.freeze({
    'app.name': 'Grove',
    'app.chineseName': '林间',
    'app.publisher': 'Fern',
    'menu.about': 'About Grove',
    'menu.language': 'Language',
    'menu.languageAuto': 'Follow system',
    'about.title': 'About Grove',
    'about.body': 'Fern’s extension suite for HanaAgent: one panel to manage it all, with small modules you can enable one by one.',
    'about.version': 'Version',
    'about.author': 'Author',
    back: 'Back',
    details: 'Details',
    'group.on': 'Enabled',
    'group.off': 'Available',
    'group.attention': 'Needs attention',
    'group.planned': 'Planned',
    'status.planned': 'Planned',
    'status.off': 'Off',
    'status.starting': 'Starting',
    'status.on': 'Running',
    'status.blocked': 'Blocked',
    'status.failed': 'Failed',
    'status.stopping': 'Stopping',
    'action.enable': 'Enable',
    'action.disable': 'Disable',
    'action.retry': 'Retry',
    'hint.blocked': 'A required permission is missing. Allow it in Hana’s app permission settings, then try again.',
    'empty.catalog': 'No modules yet.',
    'error.generic': 'Something went wrong. Please try again later.',
    'error.MIGRATION_FAILED': 'Module data migration failed. Your existing data was kept. Please try again later.',
    'error.SCHEMA_NEWER': 'This module is older than your stored data format. Update the module, then try again.',
    'module.session-stats.name': 'Sunflower',
    'module.session-stats.desc': 'Session statistics',
    'module.token-stats.name': 'Moss',
    'module.token-stats.desc': 'Token statistics',
    'module.task-manager.name': 'Squirrel',
    'module.task-manager.desc': 'Task management',
  }),
  ja: Object.freeze({
    'app.name': 'Grove',
    'app.chineseName': '林间',
    'app.publisher': 'Fern',
    'menu.about': 'Grove について',
    'menu.language': '言語',
    'menu.languageAuto': 'システムに従う',
    'about.title': 'Grove について',
    'about.body': 'Fern による HanaAgent 拡張スイート。ひとつのパネルでまとめて管理でき、小さなモジュールをひとつずつ追加できます。',
    'about.version': 'バージョン',
    'about.author': '作者',
    back: '戻る',
    details: '詳細',
    'group.on': '有効',
    'group.off': '利用可能',
    'group.attention': '要対応',
    'group.planned': '計画中',
    'status.planned': '計画中',
    'status.off': 'オフ',
    'status.starting': '起動中',
    'status.on': '実行中',
    'status.blocked': '権限なし',
    'status.failed': 'エラー',
    'status.stopping': '停止中',
    'action.enable': '有効にする',
    'action.disable': '無効にする',
    'action.retry': '再試行',
    'hint.blocked': '必要な権限がありません。Hana のアプリ権限設定で許可してから、もう一度お試しください。',
    'empty.catalog': 'モジュールはまだありません。',
    'error.generic': '問題が発生しました。しばらくしてからもう一度お試しください。',
    'error.MIGRATION_FAILED': 'モジュールデータの移行に失敗しました。既存のデータは保持されています。しばらくしてからもう一度お試しください。',
    'error.SCHEMA_NEWER': 'このモジュールは保存済みデータより古い形式です。モジュールを更新してからもう一度お試しください。',
    'module.session-stats.name': 'ひまわり',
    'module.session-stats.desc': 'セッション統計',
    'module.token-stats.name': 'こけ',
    'module.token-stats.desc': 'トークン統計',
    'module.task-manager.name': 'りす',
    'module.task-manager.desc': 'タスク管理',
  }),
  ko: Object.freeze({
    'app.name': 'Grove',
    'app.chineseName': '林间',
    'app.publisher': 'Fern',
    'menu.about': 'Grove 정보',
    'menu.language': '언어',
    'menu.languageAuto': '시스템 따르기',
    'about.title': 'Grove 정보',
    'about.body': 'Fern의 HanaAgent 확장 스위트입니다. 하나의 패널에서 모듈을 관리하고, 원하는 모듈을 하나씩 켤 수 있습니다.',
    'about.version': '버전',
    'about.author': '제작자',
    back: '뒤로',
    details: '자세히',
    'group.on': '사용 중',
    'group.off': '사용 가능',
    'group.attention': '주의 필요',
    'group.planned': '계획됨',
    'status.planned': '계획됨',
    'status.off': '꺼짐',
    'status.starting': '시작 중',
    'status.on': '실행 중',
    'status.blocked': '권한 없음',
    'status.failed': '오류',
    'status.stopping': '중지 중',
    'action.enable': '켜기',
    'action.disable': '끄기',
    'action.retry': '다시 시도',
    'hint.blocked': '필요한 권한이 없습니다. Hana의 앱 권한 설정에서 허용한 뒤 다시 시도해 주세요.',
    'empty.catalog': '아직 모듈이 없습니다.',
    'error.generic': '문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    'error.MIGRATION_FAILED': '모듈 데이터 마이그레이션에 실패했습니다. 기존 데이터는 그대로 보존되었습니다. 잠시 후 다시 시도해 주세요.',
    'error.SCHEMA_NEWER': '이 모듈은 저장된 데이터 형식보다 오래되었습니다. 모듈을 업데이트한 뒤 다시 시도해 주세요.',
    'module.session-stats.name': '해바라기',
    'module.session-stats.desc': '세션 통계',
    'module.token-stats.name': '이끼',
    'module.token-stats.desc': '토큰 통계',
    'module.task-manager.name': '다람쥐',
    'module.task-manager.desc': '작업 관리',
  }),
});

function canonicalize(tag) {
  if (typeof tag !== 'string') {
    return null;
  }
  const trimmed = tag.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const subtags = trimmed.split('-').map((part) => part.toLowerCase());
  const language = subtags[0];
  if (!/^[a-z]{2,8}$/.test(language)) {
    return null;
  }

  if (language === 'en') return 'en';
  if (language === 'ja') return 'ja';
  if (language === 'ko') return 'ko';
  if (language !== 'zh') return null;

  if (subtags.includes('hant')) return 'zh-TW';
  if (subtags.includes('hans')) return 'zh';
  if (subtags.some((part) => TRADITIONAL_CHINESE_REGIONS.has(part))) return 'zh-TW';
  return 'zh';
}

export function resolveLocale({ override, candidates } = {}) {
  const forced = canonicalize(override);
  if (forced) {
    return forced;
  }

  if (Array.isArray(candidates)) {
    for (const candidate of candidates) {
      const resolved = canonicalize(candidate);
      if (resolved) {
        return resolved;
      }
    }
  }

  return 'zh';
}

export function createTranslator(locale, dictionaries = DICTIONARIES) {
  if (typeof locale !== 'string' || !SUPPORTED_LOCALES.includes(locale)) {
    throw new Error(`unsupported locale: ${String(locale)}`);
  }

  const primary = dictionaries[locale] || {};
  const fallback = dictionaries.zh || {};

  return (key) => {
    if (typeof primary[key] === 'string') {
      return primary[key];
    }
    if (typeof fallback[key] === 'string') {
      return fallback[key];
    }
    return key;
  };
}
