type User = { name: string };

export function formatUser(u: User) {
  return u.name.toUpperCase();
}

// Intentional type error: passing wrong shape.
formatUser({ name: 123 });
