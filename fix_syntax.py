import os
import re

def fix_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # 1. Fix imports with "await"
    def remove_await_from_import(match):
        return match.group(0).replace('await ', '')
    content = re.sub(r'import\s+\{[^}]*\}\s+from\s+[\'"][^\'"]+[\'"];?', remove_await_from_import, content)

    # 2. Fix invalid export definitions in _serialize.js
    content = content.replace('export async function await publicUser', 'export async function publicUser')
    content = content.replace('export async function await publicEvent', 'export async function publicEvent')

    # 3. Fix invalid map calls
    content = content.replace(
        'rows.map((e) => await publicEvent(e, req.user.id))', 
        'await Promise.all(rows.map(async (e) => await publicEvent(e, req.user.id)))'
    )
    content = content.replace(
        'rows.map(await publicUser)',
        'await Promise.all(rows.map(async (u) => await publicUser(u)))'
    )

    # 4. In auth.routes.js, make the first user an admin automatically
    if "auth.routes.js" in path:
        auth_logic_new = """const userCount = (await db.prepare(`SELECT COUNT(*) as c FROM users`).get()).c;
    const isFirst = parseInt(userCount) === 0;
    const role = isFirst ? 'admin' : 'volunteer';
    const status = isFirst ? 'approved' : 'draft';

    const info = await db
      .prepare(
        `INSERT INTO users (contact, password_hash, role, full_name, application_status)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(contact, hashPassword(req.body.password), role, req.body.full_name || null, status);"""
        
        # We try to replace the hardcoded INSERT
        content = re.sub(
            r'const info = await db\s*\.prepare\(\s*`INSERT INTO users \(contact, password_hash, role, full_name, application_status\)\s*VALUES \(\?, \?, \'volunteer\', \?, \'draft\'\)`\s*\)\s*\.run\(contact, hashPassword\(req\.body\.password\), req\.body\.full_name \|\| null\);',
            auth_logic_new,
            content,
            flags=re.MULTILINE
        )

    if original != content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed {path}")

for root, _, files in os.walk('C:/Users/risku/Documents/antigravity/cool-mendeleev/Volunteer/src'):
    for f in files:
        if f.endswith('.js'):
            fix_file(os.path.join(root, f))
