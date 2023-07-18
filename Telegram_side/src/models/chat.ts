import { AgentExecutor,  initializeAgentExecutor, } from "langchain/agents";

import { ChatOpenAI } from "langchain/chat_models/openai";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
} from "langchain/prompts";
import { BufferMemory } from "langchain/memory";
import { ConversationChain } from "langchain/chains";
import { Configuration } from "openai";
import { OpenAIApi } from "openai";
import { PineconeClient } from "@pinecone-database/pinecone";
import { PineconeStore } from "langchain/vectorstores/pinecone";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";

const openAIApiKey = "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";

const params = {
  verbose: true,
  temperature: 0.7,
  openAIApiKey,
  modelName: process.env.OPENAI_MODEL ?? "gpt-3.5-turbo",
  maxTokens: 100,
  maxRetries: 5,
};

export class Model {
  public chain: ConversationChain;
  public openai: OpenAIApi;
  public pineconeClient: PineconeClient;
  public pineconeIndex: any;
  public vectorStore: any;
  public executor?: AgentExecutor;


  constructor() {
    const configuration = new Configuration({
      apiKey: openAIApiKey,
    });

    this.openai = new OpenAIApi(configuration);
    const model = new ChatOpenAI(params, configuration);

    // Initialize Pinecone Client
    this.pineconeClient = new PineconeClient();

    const chatPrompt = ChatPromptTemplate.fromPromptMessages([
      SystemMessagePromptTemplate.fromTemplate(
        "You are a Tinnitus expert and User is someone with tinnitus who is coming to you for help."
      ),
      new MessagesPlaceholder("history"),
      HumanMessagePromptTemplate.fromTemplate("{input}"),
    ]);

    this.chain = new ConversationChain({
      memory: new BufferMemory({ returnMessages: true }),
      prompt: chatPrompt,
      llm: model,
    });
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
    console.log(this.vectorStore)
    console.log("Vector store initialized");
  }

  public async call(input: string) {
    
    console.log("Converting input to vector...");


    console.log("Searching for most similar vectors in database...");
    
    const results = await this.vectorStore.similaritySearch(input);
    
    console.log("Search results:", results);



    console.log("Generating response using data from Pinecone database...");
    const response= await this.chain!.call({ input});
   

    return response.output;
  }
}