export type Lang = 'tr' | 'en';

// Keep `tr` and `en` key sets identical — `TranslationKey` is derived from `tr`,
// and a missing key in `en` is a type error. Add new strings to both blocks.
// This dictionary is kept in sync with frontend/src/lib/i18n.ts.
export const translations = {
  tr: {
    // ── General ──
    loading: 'Yükleniyor…',
    ok: 'Tamam',
    cancel: 'İptal',
    confirm: 'Onayla',
    delete: 'Sil',
    save: 'Kaydet',
    per_page: '/ sayfa',
    btn_prev: 'Önceki',
    btn_next: 'Sonraki',
    // ── App / nav ──
    app_name: 'Veresiye',
    nav_panel: 'Panel',
    nav_notes: 'Notlar',
    home_welcome: 'Hoş geldiniz',
    home_subtitle: 'Başlamak için kendi domain sayfalarınızı ekleyin.',
    menu_open: 'Menüyü aç',
    menu_close: 'Menüyü kapat',
    nav_logged_in: 'Giriş yapıldı',
    nav_logout: 'Çıkış',
    theme_light: 'Açık tema',
    theme_dark: 'Koyu tema',
    // ── Login ──
    login_subtitle: 'Hesabınıza giriş yapın',
    username: 'Kullanıcı adı',
    username_placeholder: 'kullaniciadi',
    password: 'Şifre',
    password_placeholder: '••••••••',
    login_remember_me: 'Beni hatırla',
    logging_in: 'Giriş yapılıyor…',
    login_btn: 'Giriş yap',
    // ── Errors ──
    err_404_title: 'Sayfa bulunamadı',
    err_404_desc: 'Aradığınız sayfa mevcut değil.',
    err_403_title: 'Erişim yok',
    err_403_desc: 'Bu sayfaya erişim yetkiniz yok.',
    err_go_home: 'Ana sayfaya dön',
    err_network: 'Bağlantı hatası. Lütfen tekrar deneyin.',
    err_unauthorized: 'Oturum sona erdi. Lütfen tekrar giriş yapın.',
    err_forbidden: 'Bu işlem için yetkiniz yok.',
    err_conflict: 'İşlem çakıştı. Lütfen tekrar deneyin.',
    err_rate_limited: 'Çok fazla istek. Lütfen biraz bekleyin.',
    err_server: 'Sunucu hatası. Lütfen tekrar deneyin.',
    // ── Notes (example app — replace with your domain) ──
    note_new: 'Yeni not',
    note_title: 'Başlık',
    note_body: 'İçerik',
    note_add: 'Not ekle',
    note_edit: 'Düzenle',
    note_delete: 'Notu sil',
    note_empty: 'Henüz not yok.',
    note_confirm_delete: 'Bu notu silmek istediğinize emin misiniz?',
  },
  en: {
    // ── General ──
    loading: 'Loading…',
    ok: 'OK',
    cancel: 'Cancel',
    confirm: 'Confirm',
    delete: 'Delete',
    save: 'Save',
    per_page: '/ page',
    btn_prev: 'Previous',
    btn_next: 'Next',
    // ── App / nav ──
    app_name: 'Veresiye',
    nav_panel: 'Panel',
    nav_notes: 'Notes',
    home_welcome: 'Welcome',
    home_subtitle: 'Add your own domain pages to get started.',
    menu_open: 'Open menu',
    menu_close: 'Close menu',
    nav_logged_in: 'Signed in',
    nav_logout: 'Log out',
    theme_light: 'Light theme',
    theme_dark: 'Dark theme',
    // ── Login ──
    login_subtitle: 'Sign in to your account',
    username: 'Username',
    username_placeholder: 'username',
    password: 'Password',
    password_placeholder: '••••••••',
    login_remember_me: 'Remember me',
    logging_in: 'Signing in…',
    login_btn: 'Sign in',
    // ── Errors ──
    err_404_title: 'Page not found',
    err_404_desc: 'The page you are looking for does not exist.',
    err_403_title: 'No access',
    err_403_desc: 'You do not have permission to view this page.',
    err_go_home: 'Go home',
    err_network: 'Connection error. Please try again.',
    err_unauthorized: 'Session expired. Please sign in again.',
    err_forbidden: 'You do not have permission for this action.',
    err_conflict: 'The request conflicted. Please try again.',
    err_rate_limited: 'Too many requests. Please wait a moment.',
    err_server: 'Server error. Please try again.',
    // ── Notes (example app — replace with your domain) ──
    note_new: 'New note',
    note_title: 'Title',
    note_body: 'Body',
    note_add: 'Add note',
    note_edit: 'Edit',
    note_delete: 'Delete note',
    note_empty: 'No notes yet.',
    note_confirm_delete: 'Are you sure you want to delete this note?',
  },
} as const;

export type TranslationKey = keyof (typeof translations)['tr'];

export function translate(lang: Lang, key: TranslationKey): string {
  return translations[lang][key];
}
