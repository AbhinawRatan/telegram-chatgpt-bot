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
  temperature: 0,
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
        "You are a Tinnitus expert and User is someone with tinnitus who is coming to you for help. Research the documents thoroughly to frame your response. When user asks you questions you will give them very short and concise answers and tell them what to do as though they were having a one on one private conversation. You can also ask them followup questions on top of your answers in order to garner more information about my situation"
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
    await this.pineconeClient.init({
      apiKey: "173b3325-ad25-4535-bbf1-96c11aa8f0ac",
      environment: "us-west1-gcp-free",
    });
    console.log("Pinecone client initialized");
    this.pineconeIndex = this.pineconeClient.Index("myproject");

    // Initialize our vector store
    this.vectorStore = await PineconeStore.fromExistingIndex(
      new OpenAIEmbeddings(),
      { pineconeIndex: this.pineconeIndex }
    );
  }

  public async call(input: string) {
    const output = await this.chain.call({ input });
    return output.output;
  }
}