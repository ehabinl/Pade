(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(["converse"], factory);
    } else {
        factory(converse);
    }
}(this, function (converse) {
    var bgWindow = chrome.extension ? chrome.extension.getBackgroundPage() : null;
    var SearchDialog = null;
    var searchDialog = null;
    var searchAvailable = false;

    converse.plugins.add("search", {
        'dependencies': [],

        'initialize': function () {
            _converse = this._converse;

            SearchDialog = _converse.BootstrapModal.extend({
                initialize() {
                    _converse.BootstrapModal.prototype.initialize.apply(this, arguments);
                    this.model.on('change', this.render, this);
                },
                toHTML() {
                  return '<div class="modal" id="myModal"> <div class="modal-dialog modal-lg"> <div class="modal-content">' +
                         '<div class="modal-header"><h1 class="modal-title">Search</h1><button type="button" class="close" data-dismiss="modal">&times;</button></div>' +
                         '<div class="modal-body">' +
                         '<input id="pade-search-keywords" class="form-control" type="text" placeholder="Type a Lucene query string and press Enter to search" ><p/><div id="pade-search-results"></div>' +
                         '</div>' +
                         '<div class="modal-footer"> <button type="button" class="btn btn-danger" data-dismiss="modal">Close</button> </div>' +
                         '</div> </div> </div>';
                },
                afterRender() {
                  var that = this;
                  this.el.addEventListener('shown.bs.modal', function()
                  {
                      if (that.model.get("keyword"))
                      {
                          that.el.querySelector('#pade-search-keywords').style.display = "none";
                          that.doSearch();
                      }
                      else {
                        that.el.querySelector('#pade-search-keywords').focus();
                      }

                  }, false);
                },
                events: {
                    'keyup #pade-search-keywords': 'keyUp'
                },

                keyUp(ev) {
                    if (ev.key === "Enter")
                    {
                        var keyword = this.el.querySelector("#pade-search-keywords").value.trim();
                        this.model.set("keyword", keyword)
                        this.doSearch();
                    }
                },

                doSearch() {
                    var that = this;
                    var keyword = that.model.get("keyword");

                    if (keyword != "" && bgWindow)
                    {
                        var searchResults = that.el.querySelector("#pade-search-results");

                        bgWindow.searchConversations(keyword, function(html, conversations, error)
                        {
                            console.debug("searchConversations", conversations, error);

                            searchResults.innerHTML = html;

                            setTimeout(function()
                            {
                                for (var i=0; i<conversations.length; i++)
                                {
                                    that.el.querySelector("#conversation-" + conversations[i].conversationID).addEventListener("click", function(e)
                                    {
                                        e.stopPropagation();
                                        chrome.extension.getViews({windowId: bgWindow.pade.chatWindow.id})[0].openChatPanel(e.target.title);

                                    }, false);
                                }
                            }, 1000);
                        });
                    }
                }
            });

            console.log("search plugin is ready");
        },

        'overrides': {
            ChatBoxView: {

                parseMessageForCommands: function(text) {
                    console.debug('search - parseMessageForCommands', text);

                    const match = text.replace(/^\s*/, "").match(/^\/(.*?)(?: (.*))?$/) || [false, '', ''];
                    const command = match[1].toLowerCase();

                    if (command === "search")
                    {
                        searchDialog = new SearchDialog({ 'model': new converse.env.Backbone.Model({keyword: match[2]}) });
                        searchDialog.show();
                        return true;
                    }
                    else

                    return this.__super__.parseMessageForCommands.apply(this, arguments);
                },

                renderToolbar: function renderToolbar(toolbar, options) {

                    if (bgWindow && bgWindow.pade.chatAPIAvailable)
                    {
                        var id = this.model.get("box_id");

                        _converse.api.listen.on('renderToolbar', function(view)
                        {
                            if (id == view.model.get("box_id") && !view.el.querySelector(".plugin-search"))
                            {
                                addToolbarItem(view, id, "pade-search-" + id, '<a class="plugin-search fa fa-search" title="Search conversations for keywords"></a>');

                                var search = document.getElementById("pade-search-" + id);

                                if (search) search.addEventListener('click', function(evt)
                                {
                                    evt.stopPropagation();

                                    searchDialog = new SearchDialog({ 'model': new converse.env.Backbone.Model({}) });
                                    searchDialog.show();
                                }, false);
                            }
                        });
                    }
                    return this.__super__.renderToolbar.apply(this, arguments);
                }
            },

            MessageView: {

                renderChatMessage: async function renderChatMessage()
                {
                    await this.__super__.renderChatMessage.apply(this, arguments);
                    var that = this;

                    if (searchAvailable)
                    {
                        converse.env._.each(that.el.querySelectorAll('.badge-hash-tag'), function (badge)
                        {
                            badge.addEventListener('click', function(evt)
                            {
                                evt.stopPropagation();

                                console.debug("pade.hashtag click", badge.innerText);
                                searchDialog = new SearchDialog({ 'model': new converse.env.Backbone.Model({keyword: badge.innerText}) });
                                searchDialog.show();
                            }, false);
                        });
                    }
                }
            }
        }
    });

    function newElement(el, id, html)
    {
        var ele = document.createElement(el);
        if (id) ele.id = id;
        if (html) ele.innerHTML = html;
        document.body.appendChild(ele);
        return ele;
    }

    var addToolbarItem = function(view, id, label, html)
    {
        var placeHolder = view.el.querySelector('#place-holder');

        if (!placeHolder)
        {
            var smiley = view.el.querySelector('.toggle-smiley.dropup');
            smiley.insertAdjacentElement('afterEnd', newElement('li', 'place-holder'));
            placeHolder = view.el.querySelector('#place-holder');
        }
        placeHolder.insertAdjacentElement('afterEnd', newElement('li', label, html));
    }

}));
