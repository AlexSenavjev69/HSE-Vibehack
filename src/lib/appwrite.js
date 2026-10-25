import { Account, Client, Functions, TablesDB } from 'appwrite'

export const appwriteConfig = {
  endpoint: import.meta.env.VITE_APPWRITE_ENDPOINT,
  projectId: import.meta.env.VITE_APPWRITE_PROJECT_ID,
  databaseId: import.meta.env.VITE_APPWRITE_DATABASE_ID,
  profileFunctionId: import.meta.env.VITE_APPWRITE_PROFILE_FUNCTION_ID,
  tableIds: {
    requestsAnswers: import.meta.env.VITE_APPWRITE_REQUESTS_ANSWERS_TABLE_ID,
    requests: import.meta.env.VITE_APPWRITE_REQUESTS_TABLE_ID,
    reviews: import.meta.env.VITE_APPWRITE_REVIEWS_TABLE_ID,
    groups: import.meta.env.VITE_APPWRITE_GROUPS_TABLE_ID,
    cities: import.meta.env.VITE_APPWRITE_CITIES_TABLE_ID,
    users: import.meta.env.VITE_APPWRITE_USERS_TABLE_ID,
  },
}

export const client = new Client()
  .setEndpoint(appwriteConfig.endpoint)
  .setProject(appwriteConfig.projectId)

// Создание сервисов не выполняет запросов к серверу.
export const account = new Account(client)
export const tablesDB = new TablesDB(client)
export const functions = new Functions(client)
