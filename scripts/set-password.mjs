// Безопасная настройка пароля администратора.
// Пароль вводится в терминале (не отображается), в .env записывается только его хеш.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { hashPassword } from '../server/auth-hash.mjs';

function ask(prompt) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(prompt);
    if (!stdin.isTTY) {
      let buf = '';
      stdin.setEncoding('utf8');
      stdin.on('data', (d) => (buf += d));
      stdin.on('end', () => resolve(buf.split('\n')[0]));
      return;
    }
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8');
    let value = '';
    const onData = (ch) => {
      if (ch === '\r' || ch === '\n' || ch === '\u0004') {
        stdin.setRawMode(false); stdin.pause(); stdin.off('data', onData); process.stdout.write('\n'); resolve(value);
      } else if (ch === '\u0003') { process.stdout.write('\n'); process.exit(1); }
      else if (ch === '\u007f' || ch === '\b') { if (value.length) { value = value.slice(0, -1); process.stdout.write('\b \b'); } }
      else { value += ch; process.stdout.write('•'); }
    };
    stdin.on('data', onData);
  });
}

const pass = await ask('Новый пароль администратора (минимум 8 символов): ');
if (pass.length < 8) { console.error('Пароль слишком короткий.'); process.exit(1); }
if (process.stdin.isTTY) {
  const again = await ask('Повторите пароль: ');
  if (again !== pass) { console.error('Пароли не совпадают.'); process.exit(1); }
}

const line = `ADMIN_PASSWORD_HASH=${hashPassword(pass)}`;
let env = existsSync('.env') ? readFileSync('.env', 'utf8') : '';
env = /^ADMIN_PASSWORD_HASH=.*$/m.test(env) ? env.replace(/^ADMIN_PASSWORD_HASH=.*$/m, line) : `${env}${env && !env.endsWith('\n') ? '\n' : ''}${line}\n`;
writeFileSync('.env', env, { mode: 0o600 });
console.log('\nГотово: хеш пароля сохранён в файл .env (для работы на компьютере).');
console.log('\nДля Vercel: Settings → Environment Variables → добавьте переменную');
console.log('  Name:  ADMIN_PASSWORD_HASH');
console.log(`  Value: ${line.slice('ADMIN_PASSWORD_HASH='.length)}`);
console.log('\nЭто не сам пароль, а его зашифрованный отпечаток. Перезапустите сервер (npm start).');
