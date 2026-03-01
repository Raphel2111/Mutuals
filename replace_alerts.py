import os
import re

directories = ['src/pages', 'src/components']

patterns = [
    (re.compile(r"alert\('([^']*(?:éxito|exitosamente|correctamente|enviado).*?)'\)", re.IGNORECASE), r"toast.success('\1')"),
    (re.compile(r"alert\('([^']*(?:Error|Failed|requerid|límite|incorrect).*?)'\)", re.IGNORECASE), r"toast.error('\1')"),
    (re.compile(r"alert\('([^']*)'\)"), r"toast.info('\1')"),
    (re.compile(r"alert\(`([^`]*(?:Error|límite).*?)`\)", re.IGNORECASE), r"toast.error(`\1`)"),
    (re.compile(r"alert\((.+?)\)"), r"toast.error(\1)")
]

for d in directories:
    dpath = os.path.join(r'c:\Users\Rafa\Desktop\MUTUALS\Mutuals\frontend_web', d)
    for f in os.listdir(dpath):
        if not f.endswith('.jsx') or f == 'Toast.jsx' or f == 'App.jsx':
            continue
        fpath = os.path.join(dpath, f)
        with open(fpath, 'r', encoding='utf-8') as file:
            content = file.read()
            
        original_content = content
        
        # apply patterns
        for pattern, replacement in patterns:
            content = pattern.sub(replacement, content)
            
        if content != original_content:
            if 'import { toast }' not in content:
                lines = content.split('\n')
                last_import_idx = 0
                for i, line in enumerate(lines):
                    if line.startswith('import '):
                        last_import_idx = i
                
                import_path = '../components/Toast' if d == 'src/pages' else './Toast'
                lines.insert(last_import_idx + 1, f"import {{ toast }} from '{import_path}';")
                content = '\n'.join(lines)
                
            with open(fpath, 'w', encoding='utf-8') as file:
                file.write(content)
            print(f'Updated {f}')

print('Done')
