"""Verify a signed AAB's JAR digests and CMS signature against a previous upload cert."""
import base64
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import zipfile
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.serialization.pkcs7 import load_der_pkcs7_certificates


def signer(archive):
    blocks = [name for name in archive.namelist() if name.startswith('META-INF/') and name.endswith('.RSA')]
    assert len(blocks) == 1, 'Expected exactly one RSA signing block'
    certificates = load_der_pkcs7_certificates(archive.read(blocks[0]))
    assert len(certificates) == 1, 'Review unexpected signer chain before release'
    return blocks[0], certificates[0].fingerprint(hashes.SHA256()).hex()


def sections(raw):
    # JAR manifests fold long UTF-8 header values with a single leading space.
    unfolded = []
    for line in raw.splitlines():
        if line.startswith(b' '):
            assert unfolded and unfolded[-1], 'Invalid manifest continuation'
            unfolded[-1] += line[1:]
        else:
            unfolded.append(line)
    records, current = [], {}
    for line in unfolded + [b'']:
        if not line:
            if current:
                records.append(current)
                current = {}
            continue
        key, value = line.split(b': ', 1)
        key = key.decode('ascii')
        assert key not in current, 'Duplicate manifest header'
        current[key] = value.decode('utf-8')
    return records


candidate, previous, openssl = map(Path, sys.argv[1:4])
with zipfile.ZipFile(previous) as old:
    _, expected = signer(old)
with zipfile.ZipFile(candidate) as archive:
    assert len(archive.namelist()) == len(set(archive.namelist())), 'Duplicate ZIP entries'
    block, actual = signer(archive)
    assert actual == expected, 'Upload signing identity changed'
    sf_name = block[:-4] + '.SF'
    sf = archive.read(sf_name)
    manifest = archive.read('META-INF/MANIFEST.MF')
    assert base64.b64decode(sections(sf)[0]['SHA-256-Digest-Manifest']) == hashlib.sha256(manifest).digest()
    entries = sections(manifest)[1:]
    covered = set()
    for entry in entries:
        name = entry['Name']
        assert name not in covered, 'Duplicate signed entry'
        assert base64.b64decode(entry['SHA-256-Digest']) == hashlib.sha256(archive.read(name)).digest(), name
        covered.add(name)
    unsigned = {name for name in archive.namelist() if not name.endswith('/')} - covered - {block, sf_name, 'META-INF/MANIFEST.MF'}
    assert not unsigned, f'Unsigned entries: {unsigned}'
    with tempfile.TemporaryDirectory(prefix='ingredient-aab-verify-') as temp:
        root = Path(temp)
        (root / 'signature.der').write_bytes(archive.read(block))
        (root / 'signed.sf').write_bytes(sf)
        result = subprocess.run([str(openssl), 'cms', '-verify', '-binary', '-inform', 'DER',
                                 '-in', str(root / 'signature.der'), '-content', str(root / 'signed.sf'),
                                 '-noverify', '-out', str(root / 'verified.sf')], capture_output=True, text=True)
        assert result.returncode == 0, result.stderr
        assert (root / 'verified.sf').read_bytes() == sf

print(json.dumps({'bundle': str(candidate.resolve()), 'sha256': hashlib.sha256(candidate.read_bytes()).hexdigest(),
                  'uploadCertificateSha256': actual, 'sameSignerAsPrevious': True,
                  'cmsSignatureVerified': True, 'signedEntriesVerified': len(covered),
                  'certificateTrust': 'Same self-signed upload certificate as the previous artifact; not a CA-chain or Google acceptance check.'}, indent=2))
