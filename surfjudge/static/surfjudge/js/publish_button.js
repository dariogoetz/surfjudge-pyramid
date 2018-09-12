(function($, undefined){
    $.widget('surfjudge.publish_button', {
        options: {
            heat_id: null,
            data: null,
        },

        _create: function(){
            this._init_html();

            this.data = this.options.data;

            this._register_events();
            this.refresh();
        },

        _destroy: function(){
            this.element.empty();
        },

        _init_html: function(){
            var _this = this;
            html = $([
                '<div class="btn-group">',
                '    <button class="btn btn-default btn-lg publish_btn">Publish</button>',
                '    <button class="btn btn-danger btn-lg unpublish_btn"><span class="fa fa-times-circle"></span></button>',
                '</div>',
            ].join(' '));

            this.element.append(html);
        },

        refresh: function(){
            var _this = this;
            var deferred = $.Deferred();
            $.getJSON('/do_get_published_scores', {heat_id: this.options.heat_id}, function(data){
                _this.data = data;
                _this._refresh();
                deferred.resolve();
            });
            return deferred.promise();
        },

        _refresh: function(){
            if (this.data.length > 0)
                this.element.find('.publish_btn').text('RE-publish');
            else
                this.element.find('.publish_btn').text('Publish');
        },

        _register_events: function(){
            this._on(this.element, {
                'click .publish_btn': this.publish,
                'click .unpublish_btn': this.unpublish,
            })
        },


        publish: function(){
            var _this = this;
            $.get('/headjudge/do_publish_results', {heat_id: this.options.heat_id}, function(){
                _this.refresh();
            });
        },

        unpublish: function(){
            var _this = this;
            $.get('/headjudge/do_delete_published_results', {heat_id: this.options.heat_id}, function(){
                _this.refresh();
            });
        },

    });

}(jQuery));
