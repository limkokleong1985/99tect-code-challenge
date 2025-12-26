import { Sequelize } from "sequelize";
import {init as Resource} from "./resource/Resource"
import hooks from "./generalHooks"

export default (sequelize:Sequelize)=>{
  // Initialize hooks
  hooks(sequelize);
  Resource(sequelize);
}