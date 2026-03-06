#!/usr/bin/env node
/**
 * gen-hash.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Utilidad para generar el hash bcrypt de tu contraseña de acceso.
 *
 * Uso:
 *   npm run gen-hash
 *   node scripts/gen-hash.js
 *
 * El script pide la contraseña de forma interactiva (no la escribe en pantalla)
 * y devuelve el hash que debes poner en PASSWORD_HASH dentro de ".env".
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const readline = require('readline');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12; // factor de coste razonable en hardware modesto

// Leer contraseña sin eco en la terminal
function readPassword(prompt) {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    // Suprimir el eco de la contraseña
    const { write } = rl.output;
    let muted = false;
    rl.output.write = function (s, ...args) {
      if (!muted) write.call(rl.output, s, ...args);
    };

    rl.question(prompt, (answer) => {
      muted = false;
      rl.output.write('\n');
      rl.close();
      resolve(answer);
    });

    // Activar supresión justo después de mostrar el prompt
    process.nextTick(() => {
      muted = true;
    });

    rl.on('error', reject);
  });
}

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('  Generador de hash bcrypt – Servidor Datos');
  console.log('═══════════════════════════════════════════');
  console.log('');

  const password = await readPassword('Introduce la contraseña: ');
  const confirm = await readPassword('Confirma la contraseña:  ');

  if (password !== confirm) {
    console.error('\n[ERROR] Las contraseñas no coinciden. Vuelve a intentarlo.');
    process.exit(1);
  }

  if (password.length < 12) {
    console.warn(
      '\n[AVISO] La contraseña tiene menos de 12 caracteres. Se recomienda una contraseña de al menos 12 caracteres.',
    );
  }

  console.log('\nGenerando hash (puede tardar unos segundos)...');
  const hash = await bcrypt.hash(password, SALT_ROUNDS);

  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('Hash generado:');
  console.log('');
  console.log(hash);
  console.log('');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('Añade la siguiente línea a tu archivo .env:');
  console.log('');
  console.log(`PASSWORD_HASH=${hash}`);
  console.log('─────────────────────────────────────────────────────────────');
  console.log('');
}

main().catch((err) => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
