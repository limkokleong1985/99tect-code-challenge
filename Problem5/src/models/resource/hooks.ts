import { Attributes, CreateOptions, Model } from "sequelize";
import { ModelHooks } from "sequelize/types/hooks";

export default <M extends Model>(): Partial<ModelHooks<M>> => ({
  beforeCreate:(instance:M, option: CreateOptions<Attributes<M>>)=>{

  }
});