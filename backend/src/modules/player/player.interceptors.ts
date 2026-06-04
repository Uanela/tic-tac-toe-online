export const afterFindMany = [
  (req: any, res: any, next: any) => {
    console.log("findMany", res.locals.data);
    next();
  },
];
