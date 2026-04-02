import type { Category } from "@cloudflare-blog/shared";

export function sortCategoriesForTree(categories: Category[]) {
  const items = [...categories].sort((left, right) => left.name.localeCompare(right.name, "ko"));
  const byId = new Map(items.map((category) => [category.id, category]));
  const children = new Map<string, Category[]>();
  const roots: Category[] = [];

  items.forEach((category) => {
    if (category.parentId && byId.has(category.parentId)) {
      children.set(category.parentId, [...(children.get(category.parentId) ?? []), category]);
      return;
    }

    roots.push(category);
  });

  const ordered: Category[] = [];

  const visit = (category: Category) => {
    ordered.push(category);
    for (const child of children.get(category.id) ?? []) {
      visit(child);
    }
  };

  roots.forEach(visit);
  return ordered;
}

export function listLeafCategories(categories: Category[]) {
  const parentIds = new Set(
    categories.map((category) => category.parentId).filter((value): value is string => Boolean(value)),
  );

  return sortCategoriesForTree(categories).filter((category) => !parentIds.has(category.id));
}

export function buildCategoryLabel(category: Category, categories: Category[]) {
  if (!category.parentId) {
    return category.name;
  }

  const parent = categories.find((item) => item.id === category.parentId);
  return parent ? `${parent.name} / ${category.name}` : category.name;
}
