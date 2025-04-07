interface Difference {
  path: string;
  type: "added" | "removed" | "changed";
  oldValue?: any;
  newValue?: any;
}

function getType(value: any): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  return typeof value;
}

export function diff(obj1: any, obj2: any, path: string = ""): Difference[] {
  const differences: Difference[] = [];
  const type1 = getType(obj1);
  const type2 = getType(obj2);

  if (type1 !== type2) {
    differences.push({
      path,
      type: "removed",
      oldValue: obj1,
    });
    differences.push({
      path,
      type: "added",
      newValue: obj2,
    });
    return differences;
  }

  if (type1 === "object") {
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    const allKeys = new Set([...keys1, ...keys2]);

    for (const key of allKeys) {
      const newPath = path ? `${path}.${key}` : key;
      if (!(key in obj2)) {
        differences.push({
          path: newPath,
          type: "removed",
          oldValue: obj1[key],
        });
      } else if (!(key in obj1)) {
        differences.push({
          path: newPath,
          type: "added",
          newValue: obj2[key],
        });
      } else {
        const subDiff = diff(obj1[key], obj2[key], newPath);
        differences.push(...subDiff);
      }
    }
  } else if (type1 === "array") {
    const len1 = obj1.length;
    const len2 = obj2.length;
    const maxLen = Math.max(len1, len2);

    for (let i = 0; i < maxLen; i++) {
      const newPath = `${path}[${i}]`;
      if (i >= len1) {
        differences.push({
          path: newPath,
          type: "added",
          newValue: obj2[i],
        });
      } else if (i >= len2) {
        differences.push({
          path: newPath,
          type: "removed",
          oldValue: obj1[i],
        });
      } else {
        const subDiff = diff(obj1[i], obj2[i], newPath);
        differences.push(...subDiff);
      }
    }
  } else {
    if (obj1 !== obj2) {
      differences.push({
        path,
        type: "changed",
        oldValue: obj1,
        newValue: obj2,
      });
    }
  }

  return differences;
}
