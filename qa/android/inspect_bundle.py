"""Read the compiled AAB manifest and compare bundled game files without changing either."""
import hashlib
import json
from pathlib import Path
import sys
import zipfile
from google.protobuf import descriptor_pb2, descriptor_pool, message_factory

schema = descriptor_pb2.FileDescriptorProto(name="manifest_subset.proto", package="inspect", syntax="proto2")
F = descriptor_pb2.FieldDescriptorProto

def message(name, fields):
    entry = schema.message_type.add(name=name)
    for name, number, kind, repeated in fields:
        field = entry.field.add(name=name, number=number, label=F.LABEL_REPEATED if repeated else F.LABEL_OPTIONAL)
        if isinstance(kind, str):
            field.type = F.TYPE_MESSAGE
            field.type_name = ".inspect." + kind
        else:
            field.type = kind

# AOSP tools/aapt2/Resources.proto field numbers; unknown fields are retained by protobuf.
message("XmlNode", [("element", 1, "XmlElement", False)])
message("XmlElement", [("name", 3, F.TYPE_STRING, False), ("attribute", 4, "XmlAttribute", True), ("child", 5, "XmlNode", True)])
message("XmlAttribute", [("namespace_uri", 1, F.TYPE_STRING, False), ("name", 2, F.TYPE_STRING, False), ("value", 3, F.TYPE_STRING, False), ("compiled_item", 6, "Item", False)])
message("Item", [("str", 2, "String", False), ("raw_str", 3, "String", False), ("prim", 7, "Primitive", False)])
message("String", [("value", 1, F.TYPE_STRING, False)])
message("Primitive", [("int_decimal_value", 6, F.TYPE_INT32, False), ("int_hexadecimal_value", 7, F.TYPE_UINT32, False), ("boolean_value", 8, F.TYPE_BOOL, False)])
pool = descriptor_pool.DescriptorPool()
pool.Add(schema)
XmlNode = message_factory.GetMessageClass(pool.FindMessageTypeByName("inspect.XmlNode"))

def attributes(element):
    result = {}
    for attr in element.attribute:
        key = ("android:" if attr.namespace_uri == "http://schemas.android.com/apk/res/android" else "") + attr.name
        compiled = attr.compiled_item
        primitive = compiled.prim.ListFields()
        result[key] = attr.value or (primitive[0][1] if primitive else compiled.str.value or compiled.raw_str.value or "[resource]")
    return result

def walk(node):
    if node.HasField("element"):
        yield node.element
        for child in node.element.child:
            yield from walk(child)

bundle = Path(sys.argv[1]).resolve()
game = Path(sys.argv[2]).resolve()
digest = hashlib.sha256(bundle.read_bytes()).hexdigest()
with zipfile.ZipFile(bundle) as archive:
    manifest = XmlNode.FromString(archive.read("base/manifest/AndroidManifest.xml"))
    root = attributes(manifest.element)
    assert root.get("package") == "io.github.maeserbern.ingredientpartygame", "Wrong app"
    kinds = {"uses-sdk", "uses-feature", "uses-permission", "supports-screens", "compatible-screens", "activity", "category"}
    settings = [{"element": item.name, "attributes": attributes(item)} for item in walk(manifest) if item.name in kinds]
    matches, differences, line_endings_only = [], [], []
    for name in archive.namelist():
        if not name.startswith("base/assets/") or name.endswith("/"):
            continue
        relative = name.removeprefix("base/assets/")
        local = (game / relative).resolve()
        assert local.is_relative_to(game)
        if local.is_file() and hashlib.sha256(archive.read(name)).digest() == hashlib.sha256(local.read_bytes()).digest():
            matches.append(relative)
        elif local.is_file() and local.suffix in {'.js', '.html', '.css', '.svg', '.json'} and archive.read(name).replace(b'\r\n', b'\n') == local.read_bytes().replace(b'\r\n', b'\n'):
            line_endings_only.append(relative)
        else:
            differences.append(relative)
    report = {"bundle": str(bundle), "sha256": digest, "manifest": root, "deviceSettings": settings,
              "matchedGameFiles": len(matches), "lineEndingsOnly": line_endings_only, "differentOrMissingGameFiles": differences,
              "nativeLibraries": [n for n in archive.namelist() if n.endswith(".so")],
              "limitation": "Manifest and asset comparison only; not native runtime or signing verification."}
assert hashlib.sha256(bundle.read_bytes()).hexdigest() == digest
print(json.dumps(report, indent=2))
