import {
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  CreationOptional,
  Sequelize
} from "sequelize";
import hooks from "./hooks";

export type ResourceStatus = "active" | "archived";

export class Resource extends Model<
  InferAttributes<Resource>,
  InferCreationAttributes<Resource>
> {
  declare id: CreationOptional<number>;
  declare name: string;
  declare description: string | null;
  declare status: ResourceStatus;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export const init = (sequelize:Sequelize)=>{
  console.log("Initializing resources...");
  Resource.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },

    name: {
      type: DataTypes.STRING(200),
      allowNull: false
    },

    description: {
      type: DataTypes.STRING(2000),
      allowNull: true
    },

    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "active",
      validate: {
        isIn: [["active", "archived"]]
      }
    },
    createdAt: "",
    updatedAt: ""
  },
  {
    sequelize,
    tableName: "resources",
    hooks: hooks<Resource>(),
    timestamps: true,
    indexes: [
      { fields: ["id"] },
      { fields: ["status"] },
      { fields: ["createdAt"] }
    ]
  });
}

