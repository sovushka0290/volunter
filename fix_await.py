import os
import re

def fix_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # Fix unawaited db.prepare and db \n .prepare
    # We replace `db.prepare` and `db \n .prepare` with `await db.prepare` if it lacks `await`
    content = re.sub(r'(?<!await\s)(?<!await)(db\s*\.\s*prepare)', r'await \1', content)

    # In auth.routes.js, properly replace the registration logic
    if "auth.routes.js" in path:
        # Let's replace the whole registration logic
        old_reg_pattern = r'const info = await db\s*\.\s*prepare\(\s*`INSERT INTO users \(contact, password_hash, role, full_name, application_status\)\s*VALUES \(\?, \?, \'volunteer\', \?, \'draft\'\)`\s*\)\s*\.\s*run\(contact, hashPassword\(req\.body\.password\), req\.body\.full_name \|\| null\);'
        
        new_reg = """const userCount = (await db.prepare(`SELECT COUNT(*) as c FROM users`).get()).c;
    const isFirst = parseInt(userCount) === 0;
    const role = isFirst ? 'admin' : 'volunteer';
    const status = isFirst ? 'approved' : 'draft';

    const info = await db
      .prepare(
        `INSERT INTO users (contact, password_hash, role, full_name, application_status)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(contact, hashPassword(req.body.password), role, req.body.full_name || null, status);"""
        
        content = re.sub(old_reg_pattern, new_reg, content, flags=re.MULTILINE)

    if original != content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed unawaited db in {path}")

for root, _, files in os.walk('C:/Users/risku/Documents/antigravity/cool-mendeleev/Volunteer/src'):
    for f in files:
        if f.endswith('.js'):
            fix_file(os.path.join(root, f))
