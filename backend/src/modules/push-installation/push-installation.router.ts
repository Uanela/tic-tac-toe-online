import { RouteHook } from "arkos";

// Installations are registered through /notifications/devices, which scopes them to the
// caller. The generated CRUD would let anyone claim or delete anyone else's.
export const hook: RouteHook = {
  findMany: { disabled: true },
  findOne: { disabled: true },
  createOne: { disabled: true },
  updateOne: { disabled: true },
  deleteOne: { disabled: true },
};
