import { ChatOpenAI } from "langchain/chat_models/openai";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
} from "langchain/prompts";
import { BufferMemory } from "langchain/memory";
import { ConversationChain } from "langchain/chains";
import { AgentExecutor, initializeAgentExecutor } from "langchain/agents";
import { Configuration } from "openai";
import { OpenAIApi } from "openai";
import { PineconeClient } from "@pinecone-database/pinecone";
import { PineconeStore } from "langchain/vectorstores/pinecone";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { Tool } from "langchain/dist/tools";
import { googleTool } from "./tools/google";

const openAIApiKey = "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";

const params = {
  verbose: true,
  temperature: 0,
  openAIApiKey,
  modelName: process.env.OPENAI_MODEL ?? "gpt-3.5-turbo",
  maxTokens: 100,
  maxRetries: 5,
  max_execution_time:1,
};

export class Model {
  public tools: Tool[];
  public openai: OpenAIApi;
  public model: ChatOpenAI = new ChatOpenAI();
  public executor?: AgentExecutor;
  public pineconeClient: PineconeClient;
  public pineconeIndex: any;
  public vectorStore: any;

  constructor() {
    const configuration = new Configuration({
      apiKey: openAIApiKey,
    });
    this.tools = [];
    this.openai = new OpenAIApi(configuration);
    const model = new ChatOpenAI(params, configuration);

    // Initialize Pinecone Client
    this.pineconeClient = new PineconeClient();

    const chatPrompt = ChatPromptTemplate.fromPromptMessages([
      SystemMessagePromptTemplate.fromTemplate(
        "Generate responses related to diet and tinnitus. Provide specific and detailed answers to questions about food, drink, and lifestyle choices that may affect tinnitus. Include information about the effects of different foods and drinks on tinnitus, as well as suggestions for dietary and lifestyle changes that may help improve tinnitus symptoms. Use a friendly and supportive tone, and provide clear and actionable advice. Limit the length of each response to 30 words."
      ),
      new MessagesPlaceholder("history"),
      HumanMessagePromptTemplate.fromTemplate("{input}"),
    ]);
  }

  public async init() {
    console.log("Initializing Pinecone client...");
    await this.pineconeClient.init({
      apiKey: "173b3325-ad25-4535-bbf1-96c11aa8f0ac",
      environment: "us-west1-gcp-free",
    });
    console.log("Pinecone client initialized");
    this.pineconeIndex = this.pineconeClient.Index("myproject");

    console.log("Initializing vector store...");
    this.vectorStore = await PineconeStore.fromExistingIndex(
      new OpenAIEmbeddings(),
      { pineconeIndex: this.pineconeIndex }
    );
    console.log(this.vectorStore);
    console.log("Vector store initialized");
  }

  public async call(input: string) {
    // Perform similarity search
    const results = await this.vectorStore.similaritySearch(input);
    console.log("Search results:", results);

    // Initialize executor if it doesn't exist
    if (!this.executor) {
      this.executor = await initializeAgentExecutor(
        this.tools,
        this.model,
        "chat-conversational-react-description",
        true
      );
      this.executor.memory = new BufferMemory({
        returnMessages: true,
        memoryKey: "chat_history",
        inputKey: "input",
      });
    }

    // Pass the input and search results to the executor
    const response = await this.executor!.call({ input, results });

    console.log("Model response: " + response);

    return response.output;
  }
}
