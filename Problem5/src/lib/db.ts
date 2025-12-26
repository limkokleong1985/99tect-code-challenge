import { Options, Sequelize } from "sequelize";

export let sequelize: Sequelize | null = null

export const init = (option: Options | undefined): Sequelize =>{
  sequelize = new Sequelize(option);
  sequelize.authenticate();
  return sequelize
}

